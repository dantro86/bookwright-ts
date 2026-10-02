import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface ScenarioStep {
  readonly title: string;
  readonly error?: { readonly message?: string };
  readonly steps?: readonly ScenarioStep[];
}

export interface ScenarioResult {
  readonly status: string;
  readonly workerIndex: number;
  readonly errors: readonly { readonly message?: string }[];
  readonly steps: readonly ScenarioStep[];
  readonly attachments: readonly {
    readonly name: string;
    readonly body?: string;
    readonly path?: string;
  }[];
}

export interface ScenarioTest {
  readonly title: string;
  /** `expected` | `unexpected` | `flaky` | `skipped` */
  readonly outcome: string;
  readonly annotations: readonly { readonly type: string; readonly description?: string }[];
  readonly result: ScenarioResult;
}

const CONFIG = join(import.meta.dirname, '..', 'scenarios', 'playwright.config.ts');
const CLI = join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');

/** Runs inner scenario files in a child Playwright process and returns its scenario report. */
export async function runScenarios(options: {
  readonly file: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly workers?: number;
}): Promise<readonly ScenarioTest[]> {
  // Playwright's own worker variables must not leak into the child runner.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith('TEST_') && !key.startsWith('PW_'),
    ),
  );
  const { stdout } = await exec(
    process.execPath,
    [
      CLI,
      'test',
      '--config',
      CONFIG,
      '--workers',
      String(options.workers ?? 2),
      // A private output directory per child run: parallel runs must not clean or overwrite
      // each other's artifacts.
      '--output',
      await mkdtemp(join(tmpdir(), 'bookwright-scenarios-')),
      options.file,
    ],
    { env: { ...inherited, ...options.env }, maxBuffer: 32 * 1024 * 1024 },
  ).catch((error: unknown) => {
    // Exit code 1 only means some scenarios failed on purpose; the report is still on stdout.
    const output = (error as { stdout?: string }).stdout;
    if (output === undefined || output.length === 0) throw error;
    return { stdout: output };
  });
  return JSON.parse(stdout) as ScenarioTest[];
}

/** Titles of all steps, depth-first, for asserting on cleanup order. */
export function stepTitles(steps: readonly ScenarioStep[]): string[] {
  return steps.flatMap((step) => [step.title, ...stepTitles(step.steps ?? [])]);
}

export function byTitle(tests: readonly ScenarioTest[], title: string): ScenarioTest {
  const found = tests.find((test) => test.title === title);
  if (!found) throw new Error(`scenario "${title}" missing from report`);
  return found;
}
