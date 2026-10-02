import { timingSafeEqual } from 'node:crypto';
import { createServer, connect, type AddressInfo, type Server as TcpServer } from 'node:net';
import { createRequire } from 'node:module';
import type * as Ssh2 from 'ssh2';
import type { Connection } from 'ssh2';

// ssh2 is CommonJS and its `Server` export is not visible to ESM named-import detection.
const { Server, utils } = createRequire(import.meta.url)('ssh2') as typeof Ssh2;

export interface KeyPair {
  readonly private: string;
  readonly public: string;
}

export function generateKeyPair(): KeyPair {
  const pair = utils.generateKeyPairSync('ed25519');
  return { private: pair.private, public: pair.public };
}

/** `known_hosts` line pinning `publicKey` for `[127.0.0.1]:port`. */
export function knownHostsLine(port: number, publicKey: string): string {
  const parsed = utils.parseKey(publicKey);
  if (parsed instanceof Error) throw parsed;
  return `[127.0.0.1]:${port} ${parsed.type} ${parsed.getPublicSSH().toString('base64')}`;
}

/**
 * In-process SSH bastion for tunnel self-tests: public-key auth for one client key, local
 * forwarding only to `allowedTarget`, which it connects to the TCP echo server.
 */
export class InProcessBastion {
  readonly hostKey = generateKeyPair();
  readonly clientKey = generateKeyPair();
  readonly allowedTarget = { host: 'mysql', port: 3306 } as const;
  readonly events: string[] = [];
  readonly #echo: TcpServer;
  readonly #ssh: Ssh2.Server;

  private constructor() {
    this.#echo = createServer((socket) => {
      socket.pipe(socket);
    });
    const allowed = utils.parseKey(this.clientKey.public);
    if (allowed instanceof Error) throw allowed;
    this.#ssh = new Server({ hostKeys: [this.hostKey.private] }, (client: Connection) => {
      client.on('authentication', (ctx) => {
        if (
          ctx.method === 'publickey' &&
          ctx.key.algo === allowed.type &&
          ctx.key.data.length === allowed.getPublicSSH().length &&
          timingSafeEqual(ctx.key.data, allowed.getPublicSSH()) &&
          (ctx.signature === undefined ||
            allowed.verify(ctx.blob ?? Buffer.alloc(0), ctx.signature, ctx.hashAlgo))
        ) {
          ctx.accept();
        } else {
          ctx.reject(['publickey']);
        }
      });
      client.on('ready', () => {
        this.events.push('client ready');
        client.on('tcpip', (accept, reject, info) => {
          if (
            info.destIP !== this.allowedTarget.host ||
            info.destPort !== this.allowedTarget.port
          ) {
            reject();
            return;
          }
          const stream = accept();
          const upstream = connect((this.#echo.address() as AddressInfo).port, '127.0.0.1');
          stream.pipe(upstream).pipe(stream);
        });
      });
      client.on('close', () => this.events.push('client closed'));
      // Rejected handshakes surface here; record them instead of crashing the worker.
      client.on('error', (error) => this.events.push(`client error: ${error.message}`));
    });
  }

  static async start(): Promise<InProcessBastion> {
    const bastion = new InProcessBastion();
    await new Promise<void>((resolve) => bastion.#echo.listen(0, '127.0.0.1', resolve));
    await new Promise<void>((resolve) => bastion.#ssh.listen(0, '127.0.0.1', resolve));
    return bastion;
  }

  get port(): number {
    return (this.#ssh.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.#ssh.close(() => {
        resolve();
      }),
    );
    await new Promise<void>((resolve) =>
      this.#echo.close(() => {
        resolve();
      }),
    );
  }
}
