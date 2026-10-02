import type { Secret } from '../../../diagnostics/secret.ts';

export interface LocalCredentials {
  readonly email: string;
  readonly password: Secret;
}

/** An API-issued session. The token reveals itself only for the `Authorization` header. */
export class LocalSession {
  readonly token: Secret;
  readonly userId: string;
  readonly expiresAt: string;

  constructor(token: Secret, userId: string, expiresAt: string) {
    this.token = token;
    this.userId = userId;
    this.expiresAt = expiresAt;
  }

  authorization(): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${this.token.reveal()}` };
  }
}
