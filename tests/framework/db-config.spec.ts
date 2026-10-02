import { expect, test } from '@playwright/test';
import { ConfigValidationError } from '../../framework/config/section.ts';
import { loadDatabaseConfig } from '../../framework/db/config.ts';
import { isKnownHostKey, knownHostKeys } from '../../framework/db/known-hosts.ts';

const base = { BW_STAND: 'local', BW_DB_SSH_PORT: '2222' };

function problems(env: Record<string, string>): readonly string[] {
  try {
    loadDatabaseConfig(env);
    return [];
  } catch (error) {
    if (error instanceof ConfigValidationError) return error.problems;
    throw error;
  }
}

test.describe('database configuration security rules', () => {
  test('key authentication requires a private key and known_hosts', () => {
    expect(problems({ ...base, BW_DB_SSH_HOST: 'bastion.example.test' })).toEqual([
      expect.stringContaining(
        'sshPrivateKeyPath (BW_DB_SSH_PRIVATE_KEY_PATH): required for key authentication',
      ),
      expect.stringContaining(
        'sshKnownHostsPath (BW_DB_SSH_KNOWN_HOSTS_PATH): required to verify the host key',
      ),
      expect.stringContaining('host-key verification is mandatory'),
    ]);
    expect(
      problems({
        ...base,
        BW_DB_SSH_HOST: 'bastion.example.test',
        BW_DB_SSH_PRIVATE_KEY_PATH: '/keys/id',
        BW_DB_SSH_KNOWN_HOSTS_PATH: '/keys/known_hosts',
      }),
    ).toEqual([]);
  });

  test('password authentication is allowed only for loopback hosts', () => {
    const password = { BW_DB_SSH_AUTH: 'password', BW_DB_SSH_PASSWORD: 'demo-password' };
    expect(
      problems({ ...base, ...password, BW_DB_SSH_HOST: 'bastion.example.test' }),
    ).toContainEqual(
      expect.stringContaining('password authentication is allowed only for loopback hosts'),
    );
    expect(problems({ ...base, ...password, BW_DB_SSH_HOST: '127.0.0.1' })).toEqual([]);
  });

  test('the database target does not exist on the prod stand', () => {
    expect(problems({ BW_STAND: 'prod' })).toEqual([
      expect.stringContaining('not available on this stand'),
    ]);
  });
});

test.describe('known_hosts pinning', () => {
  const key = Buffer.from('pinned-key');
  const file = [
    '# comment',
    `[127.0.0.1]:2222 ssh-ed25519 ${key.toString('base64')}`,
    `|1|hashed|entry ssh-ed25519 ${key.toString('base64')}`,
    `bastion,bastion.example.test ssh-ed25519 ${Buffer.from('other').toString('base64')}`,
  ].join('\n');

  test('matches host and port exactly and ignores hashed entries', () => {
    expect(knownHostKeys(file, '127.0.0.1', 2222)).toEqual([key.toString('base64')]);
    expect(knownHostKeys(file, '127.0.0.1', 2223)).toEqual([]);
    expect(knownHostKeys(file, 'bastion.example.test', 22)).toHaveLength(1);
  });

  test('rejects any key other than the pinned one', () => {
    expect(isKnownHostKey(file, '127.0.0.1', 2222, key)).toBe(true);
    expect(isKnownHostKey(file, '127.0.0.1', 2222, Buffer.from('impostor'))).toBe(false);
  });
});
