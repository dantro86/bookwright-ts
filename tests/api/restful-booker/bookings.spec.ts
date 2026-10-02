import { bookingRequest } from '../../../framework/api/restful-booker/bookings/booking-data.ts';
import { RequiredEntityNotFoundError } from '../../../framework/api/http/errors.ts';
import { expect, test } from '../../../framework/test.ts';

test.describe('restful-booker bookings', () => {
  test.use({
    reportLabels: {
      epic: 'restful-booker',
      feature: 'Bookings',
      owner: 'booking-qa',
      severity: 'critical',
    },
  });

  test(
    'booking lifecycle: create, read, update, partially update, delete',
    { tag: ['@smoke', '@api'] },
    async ({ restfulBooker: { bookings }, bookingSteps, authSession, testData }) => {
      const original = bookingRequest(testData);
      const created = await bookingSteps.create(original);
      expect(created.booking).toEqual(original);

      await expect(bookings.requireById(created.bookingid)).resolves.toEqual(original);

      const replacement = bookingRequest(testData, { lastname: original.lastname });
      await expect(bookings.update(authSession, created.bookingid, replacement)).resolves.toEqual(
        replacement,
      );

      const patch = {
        totalprice: replacement.totalprice + 1,
        depositpaid: !replacement.depositpaid,
      };
      const patched = { ...replacement, ...patch };
      await expect(bookings.partialUpdate(authSession, created.bookingid, patch)).resolves.toEqual(
        patched,
      );
      await expect(bookings.requireById(created.bookingid)).resolves.toEqual(patched);

      await bookings.delete(authSession, created.bookingid);
      await expect(bookings.findById(created.bookingid)).resolves.toBeUndefined();
    },
  );

  test(
    'required search returns the single matching booking',
    { tag: ['@regression', '@api'] },
    async ({ restfulBooker: { bookings }, existingBooking }) => {
      const { firstname, lastname } = existingBooking.booking;

      await expect(bookings.requireIdBy({ firstname, lastname })).resolves.toBe(
        existingBooking.bookingid,
      );
    },
  );

  test(
    'required search without a match fails with actionable diagnostics',
    { tag: ['@regression', '@api'] },
    async ({ restfulBooker: { bookings }, testData }) => {
      const query = { lastname: testData.unique('absent') };

      const failure = await bookings.requireIdBy(query).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RequiredEntityNotFoundError);
      expect(failure).toMatchObject({ entity: 'booking', source: 'GET /booking', count: 0 });
      expect((failure as Error).message).toContain(query.lastname);
    },
  );

  test(
    'registered cleanup deletes the booking created by a precondition',
    { tag: ['@regression', '@api'] },
    async ({ restfulBooker: { bookings }, existingBooking, teardown }) => {
      expect(teardown.pending()).toEqual([`delete booking ${existingBooking.bookingid}`]);
      await expect(bookings.requireById(existingBooking.bookingid)).resolves.toEqual(
        existingBooking.booking,
      );
    },
  );
});
