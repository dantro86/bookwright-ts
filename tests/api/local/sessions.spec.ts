import { LOCAL_AUTH_EXPECTATIONS } from '../../../framework/api/local/auth/auth-expectations.ts';
import { LocalSession } from '../../../framework/api/local/auth/local-session.ts';
import { Secret } from '../../../framework/diagnostics/secret.ts';
import { expect, test } from '../../../framework/test.ts';

test.describe('local app sessions', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Sessions',
      owner: 'booking-qa',
      severity: 'critical',
    },
  });

  test(
    'wrong password is rejected',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, newUser, testData }) => {
      const outcome = await localApi.auth.requestSession({
        email: newUser.credentials.email,
        password: Secret.of(testData.unique('wrong-password')),
      });

      expect(outcome).toEqual({
        kind: 'rejected',
        error: LOCAL_AUTH_EXPECTATIONS.invalidCredentials,
      });
    },
  );

  test(
    'request without a session is rejected',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi }) => {
      await expect(localApi.auth.check(undefined)).resolves.toEqual({
        kind: 'rejected',
        error: LOCAL_AUTH_EXPECTATIONS.missingSession,
      });
    },
  );

  test(
    'unknown session token is rejected',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, newUser, testData }) => {
      const forged = new LocalSession(
        Secret.of(testData.token(32)),
        newUser.profile.id,
        newUser.session.expiresAt,
      );

      await expect(localApi.auth.check(forged)).resolves.toEqual({
        kind: 'rejected',
        error: LOCAL_AUTH_EXPECTATIONS.invalidSession,
      });
    },
  );

  test(
    'session expires after its time to live',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, newUser }) => {
      const shortLived = await localApi.auth.login(newUser.credentials, 1);
      expect((await localApi.auth.check(shortLived)).kind).toBe('active');

      await expect
        .poll(async () => localApi.auth.check(shortLived), {
          message: 'short-lived session to be rejected as expired',
          timeout: 5_000,
          intervals: [250],
        })
        .toEqual({ kind: 'rejected', error: LOCAL_AUTH_EXPECTATIONS.expiredSession });
    },
  );

  test(
    'logout ends only the current session',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, newUser }) => {
      const second = await localApi.auth.login(newUser.credentials);

      await localApi.auth.logout(second);

      await expect(localApi.auth.check(second)).resolves.toEqual({
        kind: 'rejected',
        error: LOCAL_AUTH_EXPECTATIONS.invalidSession,
      });
      await expect(localApi.auth.current(newUser.session)).resolves.toMatchObject({
        userId: newUser.profile.id,
      });
    },
  );
});
