import { Secret } from '../../../framework/diagnostics/secret.ts';
import { test as framework } from '../../../framework/test.ts';
import { buildApp } from '../../../local-app/src/app.ts';
import { ROOMS } from '../../../local-app/src/rooms.ts';
import { MemoryStore } from '../../../local-app/src/store.ts';

export const SEED_USER = {
  email: 'seed.user@bookwright.test',
  password: 'seed-password-not-a-secret',
  displayName: 'Seed User',
} as const;

export interface InProcessApp {
  readonly store: MemoryStore;
  readonly url: string;
}

/**
 * The framework `test` with the local app started in-process per worker, so local fixtures are
 * verified without Docker or network. `localAppConfig` is overridden to point at it.
 */
export const test = framework.extend<object, { inProcessApp: InProcessApp }>({
  inProcessApp: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      const store = new MemoryStore(ROOMS);
      const app = await buildApp({ store, defaultSessionTtlSeconds: 60, seedUsers: [SEED_USER] });
      const url = await app.listen({ host: '127.0.0.1', port: 0 });
      await use({ store, url });
      await app.close();
    },
    { scope: 'worker' },
  ],
  localAppConfig: [
    async ({ inProcessApp }, use) => {
      await use({
        baseUrl: inProcessApp.url,
        existingUserEmail: SEED_USER.email,
        existingUserPassword: Secret.of(SEED_USER.password),
      });
    },
    { scope: 'worker' },
  ],
});
