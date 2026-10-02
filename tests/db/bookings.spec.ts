import { bookingRecord } from '../../framework/db/bookings/booking-data.ts';
import { SEEDED_ROOMS } from '../../framework/db/rooms/room-expectations.ts';
import { expect, test } from '../../framework/test.ts';

const TAGS = ['@db', '@local-stand'];

test.describe('booking rows over SSH', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Database',
      owner: 'data-qa',
      severity: 'critical',
    },
  });

  test(
    'write, read, join and delete through the tunnel',
    { tag: ['@smoke', ...TAGS] },
    async ({ database: { bookings }, dbBookingSteps, newUser, testData }) => {
      const record = bookingRecord(testData, newUser.profile.id);

      const inserted = await dbBookingSteps.insert(record);

      await expect(bookings.requireById(inserted.id)).resolves.toEqual(inserted);
      const room = SEEDED_ROOMS.find(({ id }) => id === record.roomId);
      const joined = await bookings.requireWithRoom(inserted.id);
      expect(joined).toMatchObject({ ...inserted, roomName: room?.name });
      expect(joined.totalEur).toBe(
        Math.round(joined.nights * (room?.nightlyEur ?? Number.NaN) * 100) / 100,
      );

      await expect(bookings.deleteById(inserted.id)).resolves.toBe(1);
      await expect(bookings.findById(inserted.id)).resolves.toBeUndefined();
    },
  );
});
