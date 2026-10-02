import { test as base, expect } from '@playwright/test';
import { connect } from 'node:net';
import { InfrastructureError } from '../../framework/db/errors.ts';
import { SshTunnel, type SshTunnelOptions } from '../../framework/db/ssh-tunnel.ts';
import { InProcessBastion, generateKeyPair, knownHostsLine } from './support/in-process-ssh.ts';

const test = base.extend<{ bastion: InProcessBastion }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
  bastion: async ({}, use) => {
    const bastion = await InProcessBastion.start();
    await use(bastion);
    await bastion.stop();
  },
});

function options(
  bastion: InProcessBastion,
  overrides: Partial<SshTunnelOptions> = {},
): SshTunnelOptions {
  return {
    host: '127.0.0.1',
    port: bastion.port,
    username: 'tunnel',
    auth: { kind: 'key', privateKey: Buffer.from(bastion.clientKey.private) },
    knownHosts: knownHostsLine(bastion.port, bastion.hostKey.public),
    target: bastion.allowedTarget,
    readyTimeoutMs: 5_000,
    ...overrides,
  };
}

/** Sends a message and resolves with the first echoed chunk. */
function roundTrip(port: number, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => socket.write(message));
    socket.once('data', (chunk) => {
      resolve(chunk.toString());
      socket.end();
    });
    socket.once('error', reject);
  });
}

test.describe('SSH tunnel', () => {
  test('forwards traffic through a dynamically allocated loopback port', async ({ bastion }) => {
    const tunnel = await SshTunnel.open(options(bastion));
    try {
      expect(tunnel.localPort).toBeGreaterThan(0);
      expect(tunnel.localPort).not.toBe(bastion.port);
      await expect(roundTrip(tunnel.localPort, 'ping through bastion')).resolves.toBe(
        'ping through bastion',
      );
    } finally {
      await tunnel.closeChannels();
      await tunnel.closeClient();
    }
  });

  test('parallel tunnels get distinct local ports', async ({ bastion }) => {
    const tunnels = await Promise.all([1, 2, 3].map(() => SshTunnel.open(options(bastion))));
    try {
      expect(new Set(tunnels.map((tunnel) => tunnel.localPort)).size).toBe(3);
    } finally {
      for (const tunnel of tunnels) {
        await tunnel.closeChannels();
        await tunnel.closeClient();
      }
    }
  });

  test('refuses a host key that is not pinned in known_hosts', async ({ bastion }) => {
    const impostor = knownHostsLine(bastion.port, generateKeyPair().public);
    await expect(SshTunnel.open(options(bastion, { knownHosts: impostor }))).rejects.toThrow(
      InfrastructureError,
    );
    expect(bastion.events).not.toContain('client ready');
  });

  test('refuses a client key the bastion does not authorize', async ({ bastion }) => {
    const stranger = { kind: 'key', privateKey: Buffer.from(generateKeyPair().private) } as const;
    await expect(SshTunnel.open(options(bastion, { auth: stranger }))).rejects.toThrow(
      /SSH connect .* failed/,
    );
  });

  test('shutdown: channels stop accepting first, then the SSH session ends', async ({
    bastion,
  }) => {
    const tunnel = await SshTunnel.open(options(bastion));
    const port = tunnel.localPort;

    await tunnel.closeChannels();
    await expect(roundTrip(port, 'late')).rejects.toThrow(/ECONNREFUSED/);
    expect(bastion.events).not.toContain('client closed');

    await tunnel.closeClient();
    await expect
      .poll(() => bastion.events, { message: 'bastion to observe the session end' })
      .toContain('client closed');
  });
});
