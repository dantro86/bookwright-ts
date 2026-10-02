import { test as base } from '@playwright/test';
import { loadCoreConfig, type CoreConfig } from '../config/core.ts';
import {
  applyReportLabels,
  recordReplayMetadata,
  type ReportLabels,
} from '../reporting/report-labels.ts';
import { TestData } from '../test-data/test-data.ts';

export interface CoreOptions {
  /** Allure domain labels for the enclosing `describe`; `undefined` for unlabelled framework tests. */
  readonly reportLabels: ReportLabels | undefined;
}

export interface CoreTestFixtures {
  readonly testData: TestData;
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
