import type { APIRequestContext } from '@playwright/test';
import { test as core } from './core.ts';
import { LocalAuthClient } from '../api/local/auth/auth-client.ts';
import { LocalBookingSteps } from '../api/local/bookings/booking-steps.ts';
import { LocalBookingsClient } from '../api/local/bookings/bookings-client.ts';
import { loadLocalAppConfig, type LocalAppConfig } from '../api/local/config.ts';
import { userRegistration } from '../api/local/users/user-data.ts';
import type { TestUser, UserMode } from '../api/local/users/user-schemas.ts';
import { UserSteps } from '../api/local/users/user-steps.ts';
import { LocalUsersClient } from '../api/local/users/users-client.ts';

export interface LocalApi {
  readonly auth: LocalAuthClient;
  readonly users: LocalUsersClient;
  readonly bookings: LocalBookingsClient;
}

export interface LocalOptions {
  /** Which user `testUser` resolves to; override with `test.use({ userMode: 'EXISTING' })`. */
  readonly userMode: UserMode;
}

export interface LocalWorkerFixtures {
  readonly localAppConfig: LocalAppConfig;
  readonly localAppRequest: APIRequestContext;
}

export interface LocalTestFixtures {
  readonly localApi: LocalApi;
  readonly userSteps: UserSteps;
  readonly localBookingSteps: LocalBookingSteps;
  /** `NEW` user: unique registration, API session, cleanup registered. */
  readonly newUser: TestUser;
  /** `EXISTING` user: configured credentials, API session. */
  readonly existingUser: TestUser;
  /** The user selected by the `userMode` option. */
  readonly testUser: TestUser;
}

export const test = core.extend<LocalOptions & LocalTestFixtures, LocalWorkerFixtures>({
  userMode: ['NEW', { option: true }],

  localAppConfig: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      await use(loadLocalAppConfig());
    },
    { scope: 'worker' },
  ],

  // Safe to share per worker: the API issues tokens in bodies, never cookies, and every
  // authenticated call sends its session explicitly.
  localAppRequest: [
    async ({ playwright, localAppConfig }, use) => {
      const request = await playwright.request.newContext({
        baseURL: localAppConfig.baseUrl,
        extraHTTPHeaders: { Accept: 'application/json' },
      });
      await use(request);
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  localApi: async ({ localAppRequest }, use) => {
    await use({
      auth: new LocalAuthClient(localAppRequest),
      users: new LocalUsersClient(localAppRequest),
      bookings: new LocalBookingsClient(localAppRequest),
    });
  },

  userSteps: async ({ localApi, teardown }, use) => {
    await use(new UserSteps(localApi.auth, localApi.users, teardown));
  },

  localBookingSteps: async ({ localApi, teardown }, use) => {
    await use(new LocalBookingSteps(localApi.bookings, teardown));
  },

  newUser: async ({ userSteps, testData }, use) => {
    await use(await userSteps.createNew(userRegistration(testData)));
  },

  existingUser: async ({ userSteps, localAppConfig }, use) => {
    await use(
      await userSteps.signInExisting({
        email: localAppConfig.existingUserEmail,
        password: localAppConfig.existingUserPassword,
      }),
    );
  },

  testUser: async ({ userMode, userSteps, testData, localAppConfig }, use) => {
    const user =
      userMode === 'NEW'
        ? await userSteps.createNew(userRegistration(testData))
        : await userSteps.signInExisting({
            email: localAppConfig.existingUserEmail,
            password: localAppConfig.existingUserPassword,
          });
    await use(user);
  },
});
