import type { APIRequestContext } from '@playwright/test';
import { test as core } from './core.ts';
import { AuthClient } from '../api/restful-booker/auth/auth-client.ts';
import type { AuthSession } from '../api/restful-booker/auth/auth-session.ts';
import { bookingRequest } from '../api/restful-booker/bookings/booking-data.ts';
import type { CreatedBooking } from '../api/restful-booker/bookings/booking-schemas.ts';
import { BookingSteps } from '../api/restful-booker/bookings/booking-steps.ts';
import { BookingsClient } from '../api/restful-booker/bookings/bookings-client.ts';
import { loadRestfulBookerConfig, type RestfulBookerConfig } from '../api/restful-booker/config.ts';
import { HealthClient } from '../api/restful-booker/health/health-client.ts';

/** restful-booker access point: one thin client per functional area. */
export interface RestfulBookerApi {
  readonly health: HealthClient;
  readonly auth: AuthClient;
  readonly bookings: BookingsClient;
}

export interface RestfulBookerWorkerFixtures {
  readonly restfulBookerConfig: RestfulBookerConfig;
  readonly restfulBookerRequest: APIRequestContext;
}

export interface RestfulBookerTestFixtures {
  readonly restfulBooker: RestfulBookerApi;
  /** Precondition: an authenticated restful-booker session for the configured demo user. */
  readonly authSession: AuthSession;
  readonly bookingSteps: BookingSteps;
  /** Precondition: a booking created through the API with cleanup registered. */
  readonly existingBooking: CreatedBooking;
}

export const test = core.extend<RestfulBookerTestFixtures, RestfulBookerWorkerFixtures>({
  restfulBookerConfig: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      await use(loadRestfulBookerConfig());
    },
    { scope: 'worker' },
  ],

  // Safe to share per worker: requests carry auth explicitly and no test relies on stored cookies.
  restfulBookerRequest: [
    async ({ playwright, restfulBookerConfig }, use) => {
      const request = await playwright.request.newContext({
        baseURL: restfulBookerConfig.baseUrl,
        extraHTTPHeaders: { Accept: 'application/json' },
      });
      await use(request);
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  restfulBooker: async ({ restfulBookerRequest }, use) => {
    await use({
      health: new HealthClient(restfulBookerRequest),
      auth: new AuthClient(restfulBookerRequest),
      bookings: new BookingsClient(restfulBookerRequest),
    });
  },

  authSession: async ({ restfulBooker, restfulBookerConfig }, use) => {
    const session = await restfulBooker.auth.createSession({
      username: restfulBookerConfig.username,
      password: restfulBookerConfig.password,
    });
    await use(session);
  },

  bookingSteps: async ({ restfulBooker, authSession, teardown }, use) => {
    await use(new BookingSteps(restfulBooker.bookings, authSession, teardown));
  },

  existingBooking: async ({ bookingSteps, testData }, use) => {
    await use(await bookingSteps.create(bookingRequest(testData)));
  },
});
