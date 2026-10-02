import { LOCAL_AUTH_EXPECTATIONS } from '../../../framework/api/local/auth/auth-expectations.ts';
import { userRegistration } from '../../../framework/api/local/users/user-data.ts';
import {
  BusinessOperationError,
  UnexpectedResponseError,
} from '../../../framework/api/http/errors.ts';
import { expect, test } from '../../../framework/test.ts';

test.describe('local app users', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Users',
      owner: 'booking-qa',
      severity: 'critical',
    },
  });

  test(
    'NEW user is registered, authenticated and owns its profile',
    { tag: ['@smoke', '@api', '@local-stand'] },
    async ({ localApi, newUser, teardown }) => {
      expect(newUser.mode).toBe('NEW');
      await expect(localApi.users.me(newUser.session)).resolves.toEqual(newUser.profile);
      expect(newUser.session.userId).toBe(newUser.profile.id);
      expect(teardown.pending()).toEqual([`delete user ${newUser.credentials.email}`]);
    },
  );

  test(
    'EXISTING user signs in with configured credentials',
    { tag: ['@smoke', '@api', '@local-stand'] },
    ({ existingUser, localAppConfig }) => {
      expect(existingUser.mode).toBe('EXISTING');
      expect(existingUser.profile.email).toBe(localAppConfig.existingUserEmail);
      expect(existingUser.session.userId).toBe(existingUser.profile.id);
    },
  );

  test(
    'registering a taken email is rejected with 409',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, existingUser, testData }) => {
      const duplicate = { ...userRegistration(testData), email: existingUser.credentials.email };

      const failure = await localApi.users.register(duplicate).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(BusinessOperationError);
      const cause = (failure as BusinessOperationError).cause;
      expect(cause).toBeInstanceOf(UnexpectedResponseError);
      expect(cause).toMatchObject({ expectedStatus: 201, actualStatus: 409 });
    },
  );

  test(
    'deleting a user revokes its sessions',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, newUser }) => {
      await localApi.users.delete(newUser.session, newUser.profile.id);

      await expect(localApi.auth.check(newUser.session)).resolves.toEqual({
        kind: 'rejected',
        error: LOCAL_AUTH_EXPECTATIONS.invalidSession,
      });
    },
  );
});
