import type { APIRequestContext } from '@playwright/test';
import { body, expectStatus, readBody, requireStatus, response } from '../../http/contract.ts';
import { RequiredEntityNotFoundError, businessOperation } from '../../http/errors.ts';
import type { LocalSession } from '../auth/local-session.ts';
import {
  LocalBookingListSchema,
  LocalBookingSchema,
  type LocalBooking,
  type NewLocalBooking,
} from './booking-schemas.ts';

export class LocalBookingsClient {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  async create(session: LocalSession, booking: NewLocalBooking): Promise<LocalBooking> {
    return businessOperation('create local booking', { roomId: booking.roomId }, () =>
      body(
        {
          request: this.#request,
          operation: 'create local booking',
          method: 'POST',
          path: '/api/bookings',
          headers: session.authorization(),
          data: booking,
        },
        201,
        LocalBookingSchema,
      ),
    );
  }

  async list(session: LocalSession): Promise<readonly LocalBooking[]> {
    return body(
      {
        request: this.#request,
        operation: 'list own bookings',
        method: 'GET',
        path: '/api/bookings',
        headers: session.authorization(),
      },
      200,
      LocalBookingListSchema,
    );
  }

  /** Optional lookup: 404 means absent or owned by someone else. */
  async findById(session: LocalSession, id: number): Promise<LocalBooking | undefined> {
    const call = {
      request: this.#request,
      operation: 'get local booking',
      method: 'GET',
      path: `/api/bookings/${id}`,
      headers: session.authorization(),
    } as const;
    const res = await response(call);
    if (res.status() === 404) {
      return undefined;
    }
    await requireStatus(call, res, 200);
    return readBody(call, res, LocalBookingSchema);
  }

  async requireById(session: LocalSession, id: number): Promise<LocalBooking> {
    const booking = await this.findById(session, id);
    if (booking === undefined) {
      throw new RequiredEntityNotFoundError({
        entity: 'local booking',
        criterion: `id=${id}`,
        source: 'GET /api/bookings/{id}',
        count: 0,
      });
    }
    return booking;
  }

  async delete(session: LocalSession, id: number): Promise<void> {
    await businessOperation('delete local booking', { id }, () =>
      expectStatus(
        {
          request: this.#request,
          operation: 'delete local booking',
          method: 'DELETE',
          path: `/api/bookings/${id}`,
          headers: session.authorization(),
        },
        204,
      ),
    );
  }
}
