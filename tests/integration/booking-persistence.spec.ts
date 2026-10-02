import { localBookingRequest } from '../../framework/api/local/bookings/booking-data.ts';
import { bookingRecord } from '../../framework/db/bookings/booking-data.ts';
import { expect, test } from '../../framework/test.ts';

const TAGS = ['@integration', '@local-stand'];

test.describe('API, database and UI agree', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Integration',
      owner: 'booking-qa',
      severity: 'blocker',
    },
  });

  test(
    'API create → DB verify over SSH → API delete → DB absence',
    { tag: ['@smoke', ...TAGS] },
    async ({ localApi, database, newUser, testData }) => {
      const created = await localApi.bookings.create(
        newUser.session,
        localBookingRequest(testData),
      );

      await expect
        .poll(() => database.bookings.findById(created.id), {
          message: `booking ${created.id} to be persisted`,
        })
        .toEqual(created);

      await localApi.bookings.delete(newUser.session, created.id);

      await expect
        .poll(() => database.bookings.findById(created.id), {
          message: `booking ${created.id} to be removed`,
        })
        .toBeUndefined();
    },
  );

  test(
    'a row written over SSH is served by the API and rendered by the UI',
    { tag: ['@regression', ...TAGS] },
    async ({ localApi, dbBookingSteps, signedInLocalUi: { bookings }, testUser, testData }) => {
      const inserted = await dbBookingSteps.insert(bookingRecord(testData, testUser.profile.id));

      await expect(localApi.bookings.requireById(testUser.session, inserted.id)).resolves.toEqual(
        inserted,
      );
      await bookings.open();
      await bookings.expectBookings([inserted]);
    },
  );

  test(
    'deleting a user cascades to its bookings in MySQL',
    { tag: ['@regression', ...TAGS] },
    async ({ localApi, database, newUser, testData }) => {
      const created = await localApi.bookings.create(
        newUser.session,
        localBookingRequest(testData),
      );

      await localApi.users.delete(newUser.session, newUser.profile.id);

      await expect
        .poll(() => database.bookings.findById(created.id), {
          message: `booking ${created.id} to be cascaded`,
        })
        .toBeUndefined();
    },
  );
});
