import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Inner configuration for fixture-runtime self-tests. The outer framework tests launch it in a child
 * process and assert on the JSON printed by `scenario-reporter.ts`, so intentionally failing scenarios never fail the outer run.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.scenario.ts',
  outputDir: join(tmpdir(), 'bookwright-scenarios'),
  fullyParallel: true,
  retries: 0,
  reporter: [['./scenario-reporter.ts']],
});
