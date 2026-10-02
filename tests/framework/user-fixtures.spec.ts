import { expect } from '../../framework/test.ts';
import { SEED_USER, test } from './support/in-process-local-app.ts';

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
    expect((await inProcessApp.store.findUserByEmail(newUser.credentials.email))?.id).toBe(
      newUser.profile.id,
    );
    expect(teardown.pending()).toEqual([`delete user ${newUser.credentials.email}`]);
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
