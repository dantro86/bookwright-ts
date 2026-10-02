import {
  ARCHIVE_USER_ID,
  SEEDED_ARCHIVE_BOOKINGS,
} from '../../framework/db/bookings/booking-expectations.ts';
import { SEEDED_ROOMS } from '../../framework/db/rooms/room-expectations.ts';
import { expect, test } from '../../framework/test.ts';

const TAGS = ['@db', '@local-stand'];

test.describe('database seed over SSH', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Database',
      owner: 'data-qa',
      severity: 'critical',
    },
  });

  test(
    'room catalog matches the deterministic seed exactly',
    { tag: ['@smoke', ...TAGS] },
    async ({ database }) => {
      await expect(database.rooms.listAll()).resolves.toEqual(SEEDED_ROOMS);
    },
  );

  test(
    'typed join returns seeded bookings with room, nights and totals',
    { tag: ['@regression', ...TAGS] },
    async ({ database }) => {
      await expect(database.bookings.listWithRoomsByUser(ARCHIVE_USER_ID)).resolves.toEqual(
        SEEDED_ARCHIVE_BOOKINGS,
      );
    },
  );

  test(
    'required lookup of a missing row reports entity, criterion, source and count',
    { tag: ['@regression', ...TAGS] },
    async ({ database }) => {
      await expect(database.bookings.requireById(999_999)).rejects.toMatchObject({
        name: 'RequiredEntityNotFoundError',
        entity: 'booking row',
        criterion: 'id=999999',
        source: 'bookings.findById',
        count: 0,
      });
      await expect(database.rooms.findById(999)).resolves.toBeUndefined();
    },
  );
});
