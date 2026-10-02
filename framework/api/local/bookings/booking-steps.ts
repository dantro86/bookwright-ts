import { test } from '@playwright/test';
import type { Teardown } from '../../../teardown/teardown.ts';
import type { LocalSession } from '../auth/local-session.ts';
import type { LocalBooking, NewLocalBooking } from './booking-schemas.ts';
import type { LocalBookingsClient } from './bookings-client.ts';

export class LocalBookingSteps {
  readonly #bookings: LocalBookingsClient;
  readonly #teardown: Teardown;

  constructor(bookings: LocalBookingsClient, teardown: Teardown) {
    this.#bookings = bookings;
    this.#teardown = teardown;
  }

  async create(session: LocalSession, booking: NewLocalBooking): Promise<LocalBooking> {
    return test.step(`create local booking for room ${booking.roomId}`, async () => {
      const created = await this.#bookings.create(session, booking);
      this.#teardown.register(`delete local booking ${created.id}`, async () => {
        if ((await this.#bookings.findById(session, created.id)) !== undefined) {
          await this.#bookings.delete(session, created.id);
        }
      });
      return created;
    });
  }
}
