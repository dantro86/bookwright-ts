import { randomUUID } from 'node:crypto';
import { test as core } from '../../../framework/fixtures/core.ts';

const test = core.extend<{ testToken: string }, { workerToken: string }>({
  workerToken: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      await use(randomUUID());
    },
    { scope: 'worker' },
  ],
  // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
  testToken: async ({}, use) => {
    await use(randomUUID());
  },
});

for (let index = 0; index < 8; index++) {
  test(`probe ${index}`, async ({ workerToken, testToken, testData, teardown }, testInfo) => {
    teardown.register(`probe ${index} cleanup`, () => Promise.resolve());
    await testInfo.attach('probe', {
      contentType: 'application/json',
      body: JSON.stringify({
        title: testInfo.title,
        workerIndex: testInfo.workerIndex,
        workerToken,
        testToken,
        data: testData.unique('probe'),
        pendingCleanup: teardown.pending(),
      }),
    });
  });
}
