import { defineConfig } from '@playwright/test';
import { ensureRunSeed } from './framework/config/core.ts';

// Generated once in the runner process and inherited by every worker.
const runSeed = ensureRunSeed();

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  // No invisible retries: a failure is diagnosed, never re-rolled.
  retries: 0,
  reporter: [
    ['list'],
    [
      './framework/reporting/safe-allure-reporter.ts',
      {
        resultsDir: 'allure-results',
        environmentInfo: {
          stand: process.env['BW_STAND'] ?? 'local',
          runSeed,
          node: process.version,
        },
      },
    ],
  ],
  use: {
    // Built-in tracing and screenshots are off: PageDiagnostics captures them per page and
    // sanitizes traces before attaching. Built-in traces would also record API request headers.
    trace: 'off',
    screenshot: 'off',
    testIdAttribute: 'data-test',
  },
  projects: [
    { name: 'framework', testDir: 'tests/framework' },
    { name: 'api', testDir: 'tests/api' },
    { name: 'ui', testDir: 'tests/ui' },
  ],
});
