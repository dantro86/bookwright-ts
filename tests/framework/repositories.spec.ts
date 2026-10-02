import { expect, test } from '@playwright/test';
import type { z } from 'zod';
import { RequiredEntityNotFoundError } from '../../framework/api/http/errors.ts';
import { BookingsRepository } from '../../framework/db/bookings/bookings-repository.ts';
import type { QueryRunner } from '../../framework/db/database.ts';
import { RoomsRepository } from '../../framework/db/rooms/rooms-repository.ts';

/** Returns canned rows and records which named query ran. */
function runner(rows: readonly unknown[], queries: string[] = []): QueryRunner {
  return {
    rows: <Schema extends z.ZodType>(name: string, _sql: string, _params: unknown, row: Schema) => {
      queries.push(name);
      return Promise.resolve(rows.map((value) => row.parse(value)));
    },
    execute: (name) => {
      queries.push(name);
      return Promise.resolve({ affectedRows: 0, insertId: 0 });
    },
  };
}

const bookingRow = {
  id: 7,
  user_id: 'u-1',
  room_id: 101,
  guest_name: 'Ada',
  checkin: '2031-01-01',
  checkout: '2031-01-03',
};

test.describe('required and optional lookups', () => {
  test('optional lookups return undefined for absence', async () => {
    await expect(new BookingsRepository(runner([])).findById(7)).resolves.toBeUndefined();
    await expect(new RoomsRepository(runner([])).findById(101)).resolves.toBeUndefined();
  });

  test('required lookups never return undefined silently', async () => {
    await expect(new BookingsRepository(runner([])).requireById(7)).rejects.toMatchObject({
      name: 'RequiredEntityNotFoundError',
      entity: 'booking row',
      criterion: 'id=7',
      source: 'bookings.findById',
      count: 0,
    });
    await expect(new RoomsRepository(runner([])).requireById(101)).rejects.toThrow(
      RequiredEntityNotFoundError,
    );
  });

  test('a required join with more than one row reports the count', async () => {
    const joined = { ...bookingRow, room_name: 'Single', nightly_eur: 79, nights: 2 };
    await expect(
      new BookingsRepository(runner([joined, joined])).requireWithRoom(7),
    ).rejects.toMatchObject({
      source: 'bookings.withRoom',
      count: 2,
    });
  });

  test('rows are mapped to typed domain records, join totals computed from nights', async () => {
    const queries: string[] = [];
    const joined = { ...bookingRow, room_name: 'Single', nightly_eur: 79.5, nights: 2 };
    await expect(
      new BookingsRepository(runner([joined], queries)).requireWithRoom(7),
    ).resolves.toEqual({
      id: 7,
      userId: 'u-1',
      roomId: 101,
      guestName: 'Ada',
      checkin: '2031-01-01',
      checkout: '2031-01-03',
      roomName: 'Single',
      nights: 2,
      totalEur: 159,
    });
    expect(queries).toEqual(['bookings.withRoom']);
  });
});
