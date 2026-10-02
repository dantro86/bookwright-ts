import type { APIRequestContext } from '@playwright/test';
import {
  body,
  expectStatus,
  readBody,
  requireStatus,
  response,
  type ApiCall,
} from '../../http/contract.ts';
import { RequiredEntityNotFoundError, businessOperation } from '../../http/errors.ts';
import type { AuthSession } from '../auth/auth-session.ts';
import {
  BookingIdsSchema,
  BookingSchema,
  CreatedBookingSchema,
  type Booking,
  type BookingPatch,
  type BookingQuery,
  type CreatedBooking,
} from './booking-schemas.ts';

export class BookingsClient {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  async create(booking: Booking): Promise<CreatedBooking> {
    return businessOperation('create booking', { lastname: booking.lastname }, () =>
      body(
        this.#call('create booking', 'POST', '/booking', { data: booking }),
        200,
        CreatedBookingSchema,
      ),
    );
  }

  /** Required lookup: a missing booking is a failure with actionable context. */
  async requireById(id: number): Promise<Booking> {
    const found = await this.findById(id);
    if (found === undefined) {
      throw new RequiredEntityNotFoundError({
        entity: 'booking',
        criterion: `id=${id}`,
        source: 'GET /booking/{id}',
        count: 0,
      });
    }
    return found;
  }

  /** Optional lookup: absence (HTTP 404) is an expected outcome, e.g. after deletion. */
  async findById(id: number): Promise<Booking | undefined> {
    const call = this.#call('get booking', 'GET', `/booking/${id}`);
    const res = await response(call);
    if (res.status() === 404) {
      return undefined;
    }
    await requireStatus(call, res, 200);
    return readBody(call, res, BookingSchema);
  }

  async searchIds(query: BookingQuery): Promise<readonly number[]> {
    const ids = await body(
      this.#call('search bookings', 'GET', '/booking', { params: { ...query } }),
      200,
      BookingIdsSchema,
    );
    return ids.map(({ bookingid }) => bookingid);
  }

  /** Required search: exactly one booking must match. */
  async requireIdBy(query: BookingQuery): Promise<number> {
    const ids = await this.searchIds(query);
    const [id] = ids;
    if (ids.length !== 1 || id === undefined) {
      throw new RequiredEntityNotFoundError({
        entity: 'booking',
        criterion: JSON.stringify(query),
        source: 'GET /booking',
        count: ids.length,
      });
    }
    return id;
  }

  async update(session: AuthSession, id: number, booking: Booking): Promise<Booking> {
    return businessOperation('update booking', { id }, () =>
      body(
        this.#call('update booking', 'PUT', `/booking/${id}`, {
          data: booking,
          headers: session.cookieHeader(),
        }),
        200,
        BookingSchema,
      ),
    );
  }

  async partialUpdate(session: AuthSession, id: number, patch: BookingPatch): Promise<Booking> {
    return businessOperation('partially update booking', { id }, () =>
      body(
        this.#call('partially update booking', 'PATCH', `/booking/${id}`, {
          data: patch,
          headers: session.cookieHeader(),
        }),
        200,
        BookingSchema,
      ),
    );
  }

  async delete(session: AuthSession, id: number): Promise<void> {
    await businessOperation('delete booking', { id }, () =>
      // restful-booker answers a successful delete with 201 Created.
      expectStatus(
        this.#call('delete booking', 'DELETE', `/booking/${id}`, {
          headers: session.cookieHeader(),
        }),
        201,
      ),
    );
  }

  #call(
    operation: string,
    method: ApiCall['method'],
    path: string,
    extra: Pick<ApiCall, 'data' | 'headers' | 'params'> = {},
  ): ApiCall {
    return { request: this.#request, operation, method, path, ...extra };
  }
}
