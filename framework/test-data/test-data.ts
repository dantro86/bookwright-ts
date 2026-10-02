import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { SeededRandom } from './seeded-random.ts';

const FIRST_NAMES = ['Ada', 'Alan', 'Barbara', 'Edsger', 'Grace', 'Ken', 'Linus', 'Margaret'];
const LAST_NAMES = ['Hopper', 'Knuth', 'Lamport', 'Liskov', 'Ritchie', 'Thompson', 'Turing'];

/** Fixed origin for generated dates so values never depend on the wall clock. */
const DATE_ORIGIN = Date.UTC(2031, 0, 1);
const DAY_MS = 86_400_000;

/** The subset of Playwright's `TestInfo` that identifies a test independent of scheduling. */
export interface TestIdentity {
  readonly testId: string;
  readonly repeatEachIndex: number;
  readonly file: string;
  readonly line: number;
  readonly project: { readonly name: string };
}

export interface ISODateRange {
  readonly start: string;
  readonly end: string;
}

/**
 * Deterministic data source for one test. Values derive only from the run seed and the stable
 * Playwright test identity, so worker assignment and execution order never change them.
 *
 * It offers domain-neutral primitives; domain payload builders live beside their domain and take a
 * `TestData` instance.
 */
export class TestData {
  readonly runSeed: string;
  readonly testSeed: string;
  readonly replayCommand: string;
  readonly #random: SeededRandom;

  private constructor(runSeed: string, testSeed: string, replayCommand: string) {
    this.runSeed = runSeed;
    this.testSeed = testSeed;
    this.replayCommand = replayCommand;
    this.#random = new SeededRandom(testSeed);
  }

  static forTest(runSeed: string, test: TestIdentity, rootDir = process.cwd()): TestData {
    const testSeed = createHash('sha256')
      .update(`${runSeed}/${test.testId}/${test.repeatEachIndex}`)
      .digest('hex')
      .slice(0, 16);
    const location = `${relative(rootDir, test.file)}:${test.line}`;
    const replayCommand = `BW_RUN_SEED=${runSeed} npx playwright test ${location} --project=${test.project.name}`;
    return new TestData(runSeed, testSeed, replayCommand);
  }

  /** Lowercase hex token, unique per test with overwhelming probability. */
  token(length = 8): string {
    return this.#random.hex(length);
  }

  /** `prefix-<token>`, for names that must not collide across parallel tests and runs. */
  unique(prefix: string): string {
    return `${prefix}-${this.token()}`;
  }

  firstName(): string {
    return this.#random.pick(FIRST_NAMES);
  }

  lastName(): string {
    return this.#random.pick(LAST_NAMES);
  }

  int(min: number, max: number): number {
    return this.#random.int(min, max);
  }

  boolean(): boolean {
    return this.#random.boolean();
  }

  pick<T>(items: readonly T[]): T {
    return this.#random.pick(items);
  }

  /** A future date range of `minDays..maxDays` days, formatted as `YYYY-MM-DD`. */
  dateRange(minDays: number, maxDays: number): ISODateRange {
    const startOffset = this.#random.int(0, 365);
    const length = this.#random.int(minDays, maxDays);
    return {
      start: isoDate(DATE_ORIGIN + startOffset * DAY_MS),
      end: isoDate(DATE_ORIGIN + (startOffset + length) * DAY_MS),
    };
  }
}

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}
