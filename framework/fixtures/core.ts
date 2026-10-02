import { test as base } from '@playwright/test';
import { loadCoreConfig, type CoreConfig } from '../config/core.ts';
import {
  applyReportLabels,
  recordReplayMetadata,
  type ReportLabels,
} from '../reporting/report-labels.ts';
import { Teardown, teardownVerdict } from '../teardown/teardown.ts';
import { TestData } from '../test-data/test-data.ts';
import { PageDiagnostics } from '../ui/diagnostics/page-diagnostics.ts';

export interface CoreOptions {
  /** Allure domain labels for the enclosing `describe`; `undefined` for unlabelled framework tests. */
  readonly reportLabels: ReportLabels | undefined;
}

export interface CoreTestFixtures {
  readonly testData: TestData;
  /** LIFO cleanup queue; register cleanup right after creating state. */
  readonly teardown: Teardown;
  readonly reportLabelsApplied: undefined;
}

export interface CoreWorkerFixtures {
  readonly coreConfig: CoreConfig;
}

export const test = base.extend<CoreOptions & CoreTestFixtures, CoreWorkerFixtures>({
  reportLabels: [undefined, { option: true }],

  coreConfig: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      await use(loadCoreConfig());
    },
    { scope: 'worker' },
  ],

  testData: async ({ coreConfig }, use, testInfo) => {
    const testData = TestData.forTest(coreConfig.runSeed, testInfo, testInfo.config.rootDir);
    await recordReplayMetadata(testData);
    await use(testData);
  },

  teardown: async ({ coreConfig }, use, testInfo) => {
    const teardown = new Teardown();
    await use(teardown);

    const failures = await teardown.runAll((name, body) => base.step(name, body));
    const verdict = teardownVerdict(failures, {
      testFailed: testInfo.status !== testInfo.expectedStatus,
      failOnError: coreConfig.teardownFailOnError,
    });
    if (verdict.kind === 'clean') {
      return;
    }
    if (verdict.kind === 'fail') {
      throw verdict.error;
    }
    // Reported, not thrown: a primary failure stays primary, and policy may allow dirty cleanup.
    const summary = verdict.failures.map((failure) => failure.message).join('\n');
    testInfo.annotations.push({ type: 'cleanup-failure', description: summary });
    await testInfo.attach('cleanup failures', { body: summary, contentType: 'text/plain' });
  },

  // Playwright still owns the browser and the fresh per-test context; this override only adds
  // failure diagnostics around the default page.
  page: async ({ page }, use, testInfo) => {
    const diagnostics = await PageDiagnostics.watch(page, 'page');
    await use(page);
    await diagnostics.finish(testInfo);
  },

  reportLabelsApplied: [
    async ({ reportLabels }, use) => {
      if (reportLabels !== undefined) {
        await applyReportLabels(reportLabels);
      }
      await use(undefined);
    },
    { auto: true },
  ],
});
