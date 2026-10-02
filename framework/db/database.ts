import { readFile } from 'node:fs/promises';
import mysql, { type Pool } from 'mysql2/promise';
import { z } from 'zod';
import { redactText } from '../diagnostics/redaction.ts';
import { BookingsRepository } from './bookings/bookings-repository.ts';
import type { DatabaseConfig } from './config.ts';
import { InfrastructureError } from './errors.ts';
import { RoomsRepository } from './rooms/rooms-repository.ts';
import { shutdownInOrder } from './shutdown.ts';
import { SshTunnel } from './ssh-tunnel.ts';

/** The pieces of an open connection, in the order they were created. */
export interface Connection {
  readonly tunnel: Pick<SshTunnel, 'localPort' | 'closeChannels' | 'closeClient'>;
  readonly pool: Pick<Pool, 'execute' | 'end'>;
}

export type ConnectionOpener = () => Promise<Connection>;

/** Runs named, parameterized queries and validates every row against a schema. */
export interface QueryRunner {
  rows<Schema extends z.ZodType>(
    name: string,
    sql: string,
    params: readonly (string | number)[],
    row: Schema,
  ): Promise<readonly z.output<Schema>[]>;
  execute(
    name: string,
    sql: string,
    params: readonly (string | number)[],
  ): Promise<{ affectedRows: number; insertId: number }>;
}

export class QueryError extends Error {
  override readonly name = 'QueryError';
  readonly query: string;

  constructor(query: string, problem: string, cause?: unknown) {
    super(
      `query "${query}" failed: ${redactText(problem)}`,
      cause === undefined ? undefined : { cause },
    );
    this.query = query;
  }
}

/**
 * Worker-scoped database access through the SSH bastion. Nothing is opened until the first query:
 * then the tunnel comes up first, the pool second. `close()` releases them in reverse: pool, SSH
 * channels, SSH client.
 */
export class Database implements QueryRunner {
  readonly bookings: BookingsRepository;
  readonly rooms: RoomsRepository;
  readonly #open: ConnectionOpener;
  #connection: Promise<Connection> | undefined;

  constructor(open: ConnectionOpener) {
    this.#open = open;
    this.bookings = new BookingsRepository(this);
    this.rooms = new RoomsRepository(this);
  }

  static throughBastion(config: DatabaseConfig): Database {
    return new Database(() => openThroughBastion(config));
  }

  get isOpen(): boolean {
    return this.#connection !== undefined;
  }

  async rows<Schema extends z.ZodType>(
    name: string,
    sql: string,
    params: readonly (string | number)[],
    row: Schema,
  ): Promise<readonly z.output<Schema>[]> {
    const { pool } = await this.#connect();
    let result: unknown;
    try {
      [result] = await pool.execute(sql, [...params]);
    } catch (error) {
      throw new QueryError(name, error instanceof Error ? error.message : String(error), error);
    }
    const parsed = z.array(row).safeParse(result, { reportInput: false });
    if (!parsed.success) {
      throw new QueryError(
        name,
        `rows do not match the expected schema:\n${z.prettifyError(parsed.error)}`,
      );
    }
    return parsed.data;
  }

  async execute(
    name: string,
    sql: string,
    params: readonly (string | number)[],
  ): Promise<{ affectedRows: number; insertId: number }> {
    const { pool } = await this.#connect();
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(sql, [...params]);
      return { affectedRows: result.affectedRows, insertId: result.insertId };
    } catch (error) {
      throw new QueryError(name, error instanceof Error ? error.message : String(error), error);
    }
  }

  /** Deterministic shutdown; a no-op when nothing was opened. */
  async close(onStep?: (name: string) => void): Promise<void> {
    if (this.#connection === undefined) {
      return;
    }
    const { pool, tunnel } = await this.#connection;
    this.#connection = undefined;
    await shutdownInOrder(
      [
        { name: 'mysql pool', close: () => pool.end() },
        { name: 'ssh channels', close: () => tunnel.closeChannels() },
        { name: 'ssh client', close: () => tunnel.closeClient() },
      ],
      onStep,
    );
  }

  #connect(): Promise<Connection> {
    this.#connection ??= this.#open().catch((error: unknown) => {
      // A failed open is not cached: the next query retries with a fresh attempt, never silently.
      this.#connection = undefined;
      throw error;
    });
    return this.#connection;
  }
}

async function openThroughBastion(config: DatabaseConfig): Promise<Connection> {
  const tunnel = await SshTunnel.open({
    host: config.sshHost,
    port: config.sshPort,
    username: config.sshUsername,
    auth:
      config.sshAuth === 'key'
        ? {
            kind: 'key',
            privateKey: await readFile(required(config.sshPrivateKeyPath, 'private key path')),
          }
        : { kind: 'password', password: required(config.sshPassword, 'password') },
    knownHosts:
      config.sshKnownHostsPath === undefined
        ? undefined
        : await readFile(config.sshKnownHostsPath, 'utf8'),
    target: { host: config.mysqlHost, port: config.mysqlPort },
    readyTimeoutMs: config.connectTimeoutMs,
  });
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: tunnel.localPort,
    database: config.mysqlDatabase,
    user: config.mysqlUser,
    password: config.mysqlPassword.reveal(),
    connectionLimit: config.poolSize,
    connectTimeout: config.connectTimeoutMs,
    timezone: 'Z',
    dateStrings: ['DATE'],
    decimalNumbers: true,
  });
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await shutdownInOrder([
      { name: 'mysql pool', close: () => pool.end() },
      { name: 'ssh channels', close: () => tunnel.closeChannels() },
      { name: 'ssh client', close: () => tunnel.closeClient() },
    ]).catch(() => undefined);
    throw new InfrastructureError('open MySQL pool through the SSH tunnel', error);
  }
  return { tunnel, pool };
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new InfrastructureError('open SSH tunnel', new Error(`${what} is not configured`));
  }
  return value;
}
