import { test } from '../../../framework/test.ts';

test.describe('restful-booker health', () => {
  test.use({
    reportLabels: {
      epic: 'restful-booker',
      feature: 'Health',
      owner: 'booking-qa',
      severity: 'blocker',
    },
  });

  test(
    'service becomes ready within the readiness budget',
    { tag: ['@smoke', '@api'] },
    async ({ restfulBooker, restfulBookerConfig }) => {
      await restfulBooker.health.waitUntilReady({
        timeoutMs: restfulBookerConfig.readinessTimeoutMs,
        intervalMs: restfulBookerConfig.readinessIntervalMs,
      });
    },
  );
});
