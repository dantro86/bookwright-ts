import type { z } from 'zod';
import {
  defineSection,
  envName,
  loadSection,
  setting,
  type Environment,
} from '../config/section.ts';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

/**
 * MySQL is reachable only through the SSH bastion. Security rules:
 * - key authentication requires a private key and a `known_hosts` file (host key pinning);
 * - password authentication and skipped host-key verification are allowed only for loopback hosts,
 *   i.e. the local demo stand.
 * Database credentials are non-production demo values of the local stand.
 */
export const databaseSection = defineSection({
  name: 'database',
  envPrefix: 'DB',
  availableOn: ['local'],
  shape: {
    sshHost: setting.string(),
    sshPort: setting.positiveInt(),
    sshUsername: setting.string(),
    sshAuth: setting.oneOf(['key', 'password']),
    sshPrivateKeyPath: setting.optional(setting.string()),
    sshKnownHostsPath: setting.optional(setting.string()),
    sshPassword: setting.optional(setting.secret()),
    mysqlHost: setting.string(),
    mysqlPort: setting.positiveInt(),
    mysqlDatabase: setting.string(),
    mysqlUser: setting.string(),
    mysqlPassword: setting.secret(),
    poolSize: setting.positiveInt(),
    connectTimeoutMs: setting.positiveInt(),
  },
  defaults: {
    sshUsername: 'tunnel',
    sshAuth: 'key',
    mysqlHost: 'mysql',
    mysqlPort: 3306,
    mysqlDatabase: 'bookwright',
    mysqlUser: 'bookwright',
    mysqlPassword: 'bookwright-demo-not-a-secret',
    poolSize: 4,
    connectTimeoutMs: 10_000,
  },
  check: (config) => {
    const name = (key: string) => envName(databaseSection, key);
    const problems: string[] = [];
    if (config.sshAuth === 'key') {
      if (config.sshPrivateKeyPath === undefined) {
        problems.push(
          `sshPrivateKeyPath (${name('sshPrivateKeyPath')}): required for key authentication`,
        );
      }
      if (config.sshKnownHostsPath === undefined) {
        problems.push(
          `sshKnownHostsPath (${name('sshKnownHostsPath')}): required to verify the host key`,
        );
      }
    } else {
      if (!isLoopback(config.sshHost)) {
        problems.push(
          `sshAuth (${name('sshAuth')}): password authentication is allowed only for loopback hosts; use key`,
        );
      }
      if (config.sshPassword === undefined) {
        problems.push(`sshPassword (${name('sshPassword')}): required for password authentication`);
      }
    }
    if (config.sshKnownHostsPath === undefined && !isLoopback(config.sshHost)) {
      problems.push(
        `sshKnownHostsPath (${name('sshKnownHostsPath')}): host-key verification is mandatory`,
      );
    }
    return problems;
  },
});

export type DatabaseConfig = z.output<z.ZodObject<typeof databaseSection.shape>>;

export function loadDatabaseConfig(env: Environment = process.env): DatabaseConfig {
  return loadSection(databaseSection, env);
}
