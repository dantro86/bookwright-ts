import type { APIRequestContext } from '@playwright/test';
import { body, expectStatus } from '../../http/contract.ts';
import { businessOperation } from '../../http/errors.ts';
import type { LocalSession } from '../auth/local-session.ts';
import { UserProfileSchema, type Registration, type UserProfile } from './user-schemas.ts';

export class LocalUsersClient {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  async register(registration: Registration): Promise<UserProfile> {
    return businessOperation('register user', { email: registration.email }, () =>
      body(
        {
          request: this.#request,
          operation: 'register user',
          method: 'POST',
          path: '/api/users',
          data: {
            email: registration.email,
            password: registration.password.reveal(),
            displayName: registration.displayName,
          },
        },
        201,
        UserProfileSchema,
      ),
    );
  }

  async me(session: LocalSession): Promise<UserProfile> {
    return body(
      {
        request: this.#request,
        operation: 'read own profile',
        method: 'GET',
        path: '/api/users/me',
        headers: session.authorization(),
      },
      200,
      UserProfileSchema,
    );
  }

  async delete(session: LocalSession, userId: string): Promise<void> {
    await businessOperation('delete user', { userId }, () =>
      expectStatus(
        {
          request: this.#request,
          operation: 'delete user',
          method: 'DELETE',
          path: `/api/users/${userId}`,
          headers: session.authorization(),
        },
        204,
      ),
    );
  }
}
