import { Secret } from '../../framework/diagnostics/secret.ts';
import { expect, test as framework } from '../../framework/test.ts';
import { buildApp } from '../../local-app/src/app.ts';
import { ROOMS } from '../../local-app/src/rooms.ts';
import { MemoryStore } from '../../local-app/src/store.ts';

const SEED_USER = {
  email: 'seed.user@bookwright.test',
  password: 'seed-password-not-a-secret',
  displayName: 'Seed User',
};

/** Runs the local app in-process so user fixtures are verified without Docker or network. */
const test = framework.extend<object, { inProcessApp: { store: MemoryStore; url: string } }>({
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

test.describe('NEW and EXISTING user fixtures', () => {
  // Runs after every test fixture of the worker was torn down: proves cleanup really happened.
  test.afterAll(({ inProcessApp }) => {
    expect(inProcessApp.store.userCount(), 'only the seeded user remains').toBe(1);
    expect(inProcessApp.store.sessionCount(), 'every fixture-created session was closed').toBe(0);
  });

  test('newUser registers a unique user, authenticates it and schedules deletion', async ({
    newUser,
    inProcessApp,
    teardown,
  }) => {
    expect(newUser.mode).toBe('NEW');
    expect(newUser.credentials.email).toMatch(/^user-[0-9a-f]{8}@bookwright\.test$/);
    expect(newUser.profile.email).toBe(newUser.credentials.email);
    expect(newUser.session.userId).toBe(newUser.profile.id);
    expect(inProcessApp.store.findUserByEmail(newUser.credentials.email)?.id).toBe(
      newUser.profile.id,
    );
    expect(teardown.pending()).toEqual([`delete user ${newUser.credentials.email}`]);
    await Promise.resolve();
  });

  test('existingUser authenticates configured credentials and schedules logout only', ({
    existingUser,
    teardown,
  }) => {
    expect(existingUser.mode).toBe('EXISTING');
    expect(existingUser.profile).toMatchObject({
      email: SEED_USER.email,
      displayName: SEED_USER.displayName,
    });
    expect(teardown.pending()).toEqual([`log out existing user ${SEED_USER.email}`]);
  });

  test('both modes return the same TestUser contract', ({ newUser, existingUser }) => {
    const shape = (user: object) => Object.keys(user).sort();
    expect(shape(newUser)).toEqual(shape(existingUser));
    expect(shape(newUser.profile)).toEqual(shape(existingUser.profile));
    expect(newUser.profile.id).not.toBe(existingUser.profile.id);
  });

  test('secret-bearing user fields never serialize', ({ newUser }) => {
    const serialized = JSON.stringify(newUser);
    expect(serialized).not.toContain(newUser.credentials.password.reveal());
    expect(serialized).not.toContain(newUser.session.token.reveal());
  });

  test('cleanup tolerates a user the scenario already deleted', async ({ newUser, localApi }) => {
    await localApi.users.delete(newUser.session, newUser.profile.id);
  });

  for (const userMode of ['NEW', 'EXISTING'] as const) {
    test.describe(`testUser with userMode=${userMode}`, () => {
      test.use({ userMode });

      test('resolves to the selected mode', ({ testUser }) => {
        expect(testUser.mode).toBe(userMode);
      });
    });
  }
});
