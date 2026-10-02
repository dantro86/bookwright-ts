import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';
import { Client, type ConnectConfig } from 'ssh2';
import type { Secret } from '../diagnostics/secret.ts';
import { InfrastructureError } from './errors.ts';
import { isKnownHostKey } from './known-hosts.ts';

export type SshAuth =
  | { readonly kind: 'key'; readonly privateKey: Buffer }
  | { readonly kind: 'password'; readonly password: Secret };

export interface SshTunnelOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly auth: SshAuth;
  /** `known_hosts` content. `undefined` skips verification: allowed by config only on loopback. */
  readonly knownHosts: string | undefined;
  /** Where the bastion should connect, as resolved from the bastion. */
  readonly target: { readonly host: string; readonly port: number };
  readonly readyTimeoutMs: number;
}

/**
 * Local TCP forwarding through an SSH bastion on a dynamically allocated loopback port. Shutdown is
 * split so callers control the order: first `closeChannels` (stop accepting, drop forwarded
 * sockets), then `closeClient` (end the SSH session).
 */
export class SshTunnel {
  readonly #client: Client;
  readonly #server: Server;
  readonly #sockets = new Set<Socket>();

  private constructor(client: Client, server: Server) {
    this.#client = client;
    this.#server = server;
  }

  static async open(options: SshTunnelOptions): Promise<SshTunnel> {
    const client = await connect(options);
    const server = createServer();
    const tunnel = new SshTunnel(client, server);
    server.on('connection', (socket) => {
      tunnel.#forward(socket, options.target);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        // Port 0: the OS picks a free port, so parallel workers and stands never collide.
        server.listen(0, '127.0.0.1', resolve);
      });
    } catch (error) {
      client.end();
      throw new InfrastructureError('open local forwarding port', error);
    }
    return tunnel;
  }

  get localPort(): number {
    return (this.#server.address() as AddressInfo).port;
  }

  async closeChannels(): Promise<void> {
    for (const socket of this.#sockets) {
      socket.destroy();
    }
    if (!this.#server.listening) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async closeClient(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.#client.once('close', () => {
        resolve();
      });
      this.#client.end();
    });
  }

  #forward(socket: Socket, target: SshTunnelOptions['target']): void {
    this.#sockets.add(socket);
    socket.once('close', () => this.#sockets.delete(socket));
    this.#client.forwardOut(
      '127.0.0.1',
      socket.remotePort ?? 0,
      target.host,
      target.port,
      (error, stream) => {
        if (error) {
          socket.destroy(error);
          return;
        }
        socket.pipe(stream).pipe(socket);
        socket.once('close', () => {
          stream.close();
        });
        stream.once('close', () => socket.destroy());
      },
    );
  }
}

function connect(options: SshTunnelOptions): Promise<Client> {
  const client = new Client();
  const config: ConnectConfig = {
    host: options.host,
    port: options.port,
    username: options.username,
    readyTimeout: options.readyTimeoutMs,
    ...(options.auth.kind === 'key'
      ? { privateKey: options.auth.privateKey }
      : { password: options.auth.password.reveal() }),
    hostVerifier: (key: Buffer) =>
      options.knownHosts === undefined ||
      isKnownHostKey(options.knownHosts, options.host, options.port, key),
  };
  return new Promise<Client>((resolve, reject) => {
    client.once('ready', () => {
      resolve(client);
    });
    client.once('error', (error) => {
      reject(new InfrastructureError(`SSH connect to ${options.host}:${options.port}`, error));
    });
    client.connect(config);
  });
}
