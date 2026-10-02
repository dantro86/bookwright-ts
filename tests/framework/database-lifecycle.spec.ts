import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { Database, QueryError, type Connection } from '../../framework/db/database.ts';
import { ShutdownError } from '../../framework/db/errors.ts';

function fakeConnection(
  events: string[],
  options: { failPoolEnd?: boolean; rows?: unknown[] } = {},
): Connection {
  return {
    tunnel: {
      localPort: 40_000,
      closeChannels: () => Promise.resolve(void events.push('close ssh channels')),
      closeClient: () => Promise.resolve(void events.push('close ssh client')),
    },
    pool: {
      execute: () => Promise.resolve([options.rows ?? [{ id: 1 }], []]),
      end: () =>
        options.failPoolEnd
          ? Promise.reject(new Error('pool end failed password=hunter2'))
          : Promise.resolve(void events.push('end mysql pool')),
    } as unknown as Connection['pool'],
  };
}

const Row = z.object({ id: z.number() });

test.describe('database lifecycle', () => {
  test('opens nothing until the first query, then opens once for concurrent queries', async () => {
    const events: string[] = [];
    const database = new Database(() => {
      events.push('open tunnel', 'open pool');
      return Promise.resolve(fakeConnection(events));
    });
    expect(database.isOpen).toBe(false);
    expect(events).toEqual([]);

    await Promise.all([1, 2, 3].map(() => database.rows('probe', 'SELECT 1', [], Row)));

    expect(database.isOpen).toBe(true);
    expect(events).toEqual(['open tunnel', 'open pool']);
  });

  test('closes pool, then SSH channels, then SSH client', async () => {
    const events: string[] = [];
    const steps: string[] = [];
    const database = new Database(() => Promise.resolve(fakeConnection(events)));
    await database.rows('probe', 'SELECT 1', [], Row);

    await database.close((name) => steps.push(name));

    expect(steps).toEqual(['mysql pool', 'ssh channels', 'ssh client']);
    expect(events).toEqual(['end mysql pool', 'close ssh channels', 'close ssh client']);
    expect(database.isOpen).toBe(false);
  });

  test('a failing step does not stop later steps and is reported safely', async () => {
    const events: string[] = [];
    const database = new Database(() =>
      Promise.resolve(fakeConnection(events, { failPoolEnd: true })),
    );
    await database.rows('probe', 'SELECT 1', [], Row);

    const failure = await database.close().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ShutdownError);
    expect((failure as Error).message).toContain('close mysql pool failed');
    expect((failure as Error).message).not.toContain('hunter2');
    expect(events).toEqual(['close ssh channels', 'close ssh client']);
  });

  test('closing a never-opened database is a no-op', async () => {
    let opened = false;
    const database = new Database(() => {
      opened = true;
      return Promise.resolve(fakeConnection([]));
    });
    await database.close();
    expect(opened).toBe(false);
  });

  test('a failed open is not cached', async () => {
    let attempts = 0;
    const database = new Database(() =>
      ++attempts === 1
        ? Promise.reject(new Error('bastion down'))
        : Promise.resolve(fakeConnection([])),
    );

    await expect(database.rows('probe', 'SELECT 1', [], Row)).rejects.toThrow('bastion down');
    await expect(database.rows('probe', 'SELECT 1', [], Row)).resolves.toEqual([{ id: 1 }]);
    expect(attempts).toBe(2);
  });

  test('rows that break the schema fail with the query name', async () => {
    const database = new Database(() =>
      Promise.resolve(fakeConnection([], { rows: [{ id: 'one' }] })),
    );
    await expect(database.rows('rooms.listAll', 'SELECT 1', [], Row)).rejects.toThrow(QueryError);
    await expect(database.rows('rooms.listAll', 'SELECT 1', [], Row)).rejects.toThrow(
      /query "rooms.listAll" failed/,
    );
  });
});
