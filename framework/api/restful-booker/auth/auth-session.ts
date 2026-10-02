import type { Secret } from '../../../diagnostics/secret.ts';

export interface Credentials {
  readonly username: string;
  readonly password: Secret;
}

/** A restful-booker token. Serializes and inspects as redacted; only `cookieHeader` reveals it. */
export class AuthSession {
  readonly username: string;
  readonly token: Secret;

  constructor(username: string, token: Secret) {
    this.username = username;
    this.token = token;
  }

  /** restful-booker accepts the token as a `token` cookie on write operations. */
  cookieHeader(): Readonly<Record<string, string>> {
    return { Cookie: `token=${this.token.reveal()}` };
  }
}
