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
      'allure-playwright',
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
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'framework', testDir: 'tests/framework' },
    { name: 'api', testDir: 'tests/api' },
  ],
});
