import { z } from 'zod';
import type { Secret } from '../../../diagnostics/secret.ts';
import type { LocalCredentials, LocalSession } from '../auth/local-session.ts';

export const UserProfileSchema = z
  .object({ id: z.uuid(), email: z.email(), displayName: z.string(), createdAt: z.iso.datetime() })
  .strict();

export type UserProfile = z.output<typeof UserProfileSchema>;

export interface Registration {
  readonly email: string;
  readonly password: Secret;
  readonly displayName: string;
}

export type UserMode = 'NEW' | 'EXISTING';

/** The one user contract both `NEW` and `EXISTING` modes return. */
export interface TestUser {
  readonly mode: UserMode;
  readonly credentials: LocalCredentials;
  readonly profile: UserProfile;
  readonly session: LocalSession;
}
