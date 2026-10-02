import { AUTH_EXPECTATIONS } from '../../../framework/api/restful-booker/auth/auth-expectations.ts';
import { Secret } from '../../../framework/diagnostics/secret.ts';
import { expect, test } from '../../../framework/test.ts';

test.describe('restful-booker authentication', () => {
  test.use({
    reportLabels: {
      epic: 'restful-booker',
      feature: 'Authentication',
      owner: 'booking-qa',
      severity: 'critical',
    },
  });

  test(
    'configured demo user receives a token',
    { tag: ['@smoke', '@api'] },
    ({ authSession, restfulBookerConfig }) => {
      expect(authSession.username).toBe(restfulBookerConfig.username);
      expect(authSession.token.reveal()).not.toHaveLength(0);
    },
  );

  test(
    'wrong password is rejected without a token',
    { tag: ['@regression', '@api'] },
    async ({ restfulBooker, restfulBookerConfig, testData }) => {
      const outcome = await restfulBooker.auth.requestToken({
        username: restfulBookerConfig.username,
        password: Secret.of(testData.unique('wrong-password')),
      });

      expect(outcome).toEqual({ kind: 'rejected', reason: AUTH_EXPECTATIONS.rejectionReason });
    },
  );
});
