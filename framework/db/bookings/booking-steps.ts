import { test } from '@playwright/test';
import type { Teardown } from '../../teardown/teardown.ts';
import type { BookingRecord, BookingsRepository, NewBookingRecord } from './bookings-repository.ts';

/** Direct database writes through the tunnel, each with registered cleanup. */
export class DbBookingSteps {
  readonly #bookings: BookingsRepository;
  readonly #teardown: Teardown;

  constructor(bookings: BookingsRepository, teardown: Teardown) {
    this.#bookings = bookings;
    this.#teardown = teardown;
  }

  async insert(booking: NewBookingRecord): Promise<BookingRecord> {
    return test.step(`insert booking row for room ${booking.roomId}`, async () => {
      const inserted = await this.#bookings.insert(booking);
      // DELETE is idempotent: an already removed row simply affects zero rows.
      this.#teardown.register(`delete booking row ${inserted.id}`, async () => {
        await this.#bookings.deleteById(inserted.id);
      });
      return inserted;
    });
  }
}
