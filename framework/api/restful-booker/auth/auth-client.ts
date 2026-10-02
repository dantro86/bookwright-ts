import type { APIRequestContext } from '@playwright/test';
import { z } from 'zod';
import { body } from '../../http/contract.ts';
import { businessOperation } from '../../http/errors.ts';
import { Secret } from '../../../diagnostics/secret.ts';
import { AuthSession, type Credentials } from './auth-session.ts';

/** restful-booker answers both outcomes with HTTP 200; the body shape is the contract. */
const AuthResponseSchema = z.union([
  z.object({ token: z.string().min(1) }).strict(),
  z.object({ reason: z.string().min(1) }).strict(),
]);

export type AuthOutcome =
  | { readonly kind: 'granted'; readonly session: AuthSession }
  | { readonly kind: 'rejected'; readonly reason: string };

export class AuthClient {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  async requestToken(credentials: Credentials): Promise<AuthOutcome> {
    const result = await body(
      {
        request: this.#request,
        operation: 'request auth token',
        method: 'POST',
        path: '/auth',
        data: { username: credentials.username, password: credentials.password.reveal() },
      },
      200,
      AuthResponseSchema,
    );
    return 'token' in result
      ? { kind: 'granted', session: new AuthSession(credentials.username, Secret.of(result.token)) }
      : { kind: 'rejected', reason: result.reason };
  }

  /** Authenticates and requires success: a rejection is a terminal failure, never retried. */
  async createSession(credentials: Credentials): Promise<AuthSession> {
    return businessOperation(
      'create auth session',
      { username: credentials.username },
      async () => {
        const outcome = await this.requestToken(credentials);
        if (outcome.kind === 'rejected') {
          throw new Error(`authentication rejected: ${outcome.reason}`);
        }
        return outcome.session;
      },
    );
  }
}
