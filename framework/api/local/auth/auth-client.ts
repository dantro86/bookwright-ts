import type { APIRequestContext } from '@playwright/test';
import { z } from 'zod';
import { Secret } from '../../../diagnostics/secret.ts';
import { body, expectStatus, readBody, requireStatus, response } from '../../http/contract.ts';
import { businessOperation } from '../../http/errors.ts';
import { LocalSession, type LocalCredentials } from './local-session.ts';

const SessionSchema = z
  .object({ token: z.string().min(1), userId: z.uuid(), expiresAt: z.iso.datetime() })
  .strict();
const SessionInfoSchema = z.object({ userId: z.uuid(), expiresAt: z.iso.datetime() }).strict();
export const ApiErrorSchema = z.object({ error: z.string(), message: z.string() }).strict();

export type SessionInfo = z.output<typeof SessionInfoSchema>;
export type SessionRejection = 'session_missing' | 'session_invalid' | 'session_expired';

export type LoginOutcome =
  | { readonly kind: 'granted'; readonly session: LocalSession }
  | { readonly kind: 'rejected'; readonly error: string };

export type SessionCheck =
  | { readonly kind: 'active'; readonly info: SessionInfo }
  | { readonly kind: 'rejected'; readonly error: SessionRejection };

export class LocalAuthClient {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  async requestSession(credentials: LocalCredentials, ttlSeconds?: number): Promise<LoginOutcome> {
    const call = {
      request: this.#request,
      operation: 'create session',
      method: 'POST',
      path: '/api/sessions',
      data: {
        email: credentials.email,
        password: credentials.password.reveal(),
        ...(ttlSeconds !== undefined && { ttlSeconds }),
      },
    } as const;
    const res = await response(call);
    if (res.status() === 401) {
      return { kind: 'rejected', error: (await readBody(call, res, ApiErrorSchema)).error };
    }
    await requireStatus(call, res, 201);
    const session = await readBody(call, res, SessionSchema);
    return {
      kind: 'granted',
      session: new LocalSession(Secret.of(session.token), session.userId, session.expiresAt),
    };
  }

  /** Authenticates and requires success; a rejection is terminal. */
  async login(credentials: LocalCredentials, ttlSeconds?: number): Promise<LocalSession> {
    return businessOperation('log in', { email: credentials.email }, async () => {
      const outcome = await this.requestSession(credentials, ttlSeconds);
      if (outcome.kind === 'rejected') {
        throw new Error(`login rejected: ${outcome.error}`);
      }
      return outcome.session;
    });
  }

  /** Classifies the session state; pass `undefined` to probe an unauthenticated request. */
  async check(session: LocalSession | undefined): Promise<SessionCheck> {
    const call = {
      request: this.#request,
      operation: 'check session',
      method: 'GET',
      path: '/api/sessions/current',
      ...(session && { headers: session.authorization() }),
    } as const;
    const res = await response(call);
    if (res.status() === 401) {
      const { error } = await readBody(call, res, ApiErrorSchema);
      return {
        kind: 'rejected',
        error: z.enum(['session_missing', 'session_invalid', 'session_expired']).parse(error),
      };
    }
    await requireStatus(call, res, 200);
    return { kind: 'active', info: await readBody(call, res, SessionInfoSchema) };
  }

  async current(session: LocalSession): Promise<SessionInfo> {
    return body(
      {
        request: this.#request,
        operation: 'read current session',
        method: 'GET',
        path: '/api/sessions/current',
        headers: session.authorization(),
      },
      200,
      SessionInfoSchema,
    );
  }

  async logout(session: LocalSession): Promise<void> {
    await businessOperation('log out', { userId: session.userId }, () =>
      expectStatus(
        {
          request: this.#request,
          operation: 'log out',
          method: 'DELETE',
          path: '/api/sessions/current',
          headers: session.authorization(),
        },
        204,
      ),
    );
  }
}
