import { test } from '@playwright/test';
import type { Teardown } from '../../../teardown/teardown.ts';
import type { LocalAuthClient } from '../auth/auth-client.ts';
import type { LocalCredentials } from '../auth/local-session.ts';
import type { Registration, TestUser } from './user-schemas.ts';
import type { LocalUsersClient } from './users-client.ts';

/** User lifecycle operations. Credentials always come from callers: generated or configured. */
export class UserSteps {
  readonly #auth: LocalAuthClient;
  readonly #users: LocalUsersClient;
  readonly #teardown: Teardown;

  constructor(auth: LocalAuthClient, users: LocalUsersClient, teardown: Teardown) {
    this.#auth = auth;
    this.#users = users;
    this.#teardown = teardown;
  }

  /** `NEW` mode: register, register cleanup, then authenticate through the API. */
  async createNew(registration: Registration): Promise<TestUser> {
    return test.step(`create new user ${registration.email}`, async () => {
      const profile = await this.#users.register(registration);
      const credentials = { email: registration.email, password: registration.password };
      this.#teardown.register(`delete user ${registration.email}`, () =>
        this.deleteIfPresent(credentials),
      );
      const session = await this.#auth.login(credentials);
      return { mode: 'NEW', credentials, profile, session };
    });
  }

  /** `EXISTING` mode: authenticate configured credentials; only the new session is cleaned up. */
  async signInExisting(credentials: LocalCredentials): Promise<TestUser> {
    return test.step(`sign in existing user ${credentials.email}`, async () => {
      const session = await this.#auth.login(credentials);
      this.#teardown.register(`log out existing user ${credentials.email}`, async () => {
        if ((await this.#auth.check(session)).kind === 'active') {
          await this.#auth.logout(session);
        }
      });
      const profile = await this.#users.me(session);
      return { mode: 'EXISTING', credentials, profile, session };
    });
  }

  /** Query first: the scenario may already have deleted the user. */
  async deleteIfPresent(credentials: LocalCredentials): Promise<void> {
    const outcome = await this.#auth.requestSession(credentials);
    if (outcome.kind === 'rejected') {
      return;
    }
    await this.#users.delete(outcome.session, outcome.session.userId);
  }
}
