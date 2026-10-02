import { test } from '@playwright/test';
import type { Teardown } from '../../../teardown/teardown.ts';
import type { AuthSession } from '../auth/auth-session.ts';
import type { Booking, CreatedBooking } from './booking-schemas.ts';
import type { BookingsClient } from './bookings-client.ts';

/**
 * Business operations on restful-booker bookings. Steps own cleanup registration; they never invent
 * payloads: callers pass data built from `TestData` or domain fixtures.
 */
export class BookingSteps {
  readonly #bookings: BookingsClient;
  readonly #session: AuthSession;
  readonly #teardown: Teardown;

  constructor(bookings: BookingsClient, session: AuthSession, teardown: Teardown) {
    this.#bookings = bookings;
    this.#session = session;
    this.#teardown = teardown;
  }

  async create(booking: Booking): Promise<CreatedBooking> {
    return test.step(`create booking for guest ${booking.lastname}`, async () => {
      const created = await this.#bookings.create(booking);
      this.#teardown.register(`delete booking ${created.bookingid}`, () =>
        this.deleteIfPresent(created.bookingid),
      );
      return created;
    });
  }

  /** Query first: a scenario may already have deleted the booking it created. */
  async deleteIfPresent(id: number): Promise<void> {
    if ((await this.#bookings.findById(id)) !== undefined) {
      await this.#bookings.delete(this.#session, id);
    }
  }
}
