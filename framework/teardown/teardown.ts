import { redactText, sanitizeError } from '../diagnostics/redaction.ts';

export interface CleanupAction {
  readonly name: string;
  readonly execute: () => Promise<void>;
}

/** Runs one cleanup action inside a named report step; the fixture passes `test.step`. */
export type StepRunner = (name: string, body: () => Promise<void>) => Promise<void>;

export class CleanupError extends Error {
  override readonly name = 'CleanupError';
  readonly action: string;

  constructor(action: string, cause: unknown) {
    const safeCause = sanitizeError(cause);
    super(`cleanup "${redactText(action)}" failed: ${safeCause.message}`, { cause: safeCause });
    this.action = action;
  }
}

export class TeardownFailedError extends Error {
  override readonly name = 'TeardownFailedError';
  readonly failures: readonly CleanupError[];

  constructor(failures: readonly CleanupError[]) {
    super(
      [
        `${failures.length} cleanup action(s) failed after an otherwise successful test:`,
        ...failures.map((failure) => `  - ${failure.message}`),
      ].join('\n'),
      { cause: failures[0] },
    );
    this.failures = failures;
  }
}

/**
 * Test-scoped LIFO cleanup queue. Code that creates state registers its cleanup immediately after
 * the creation succeeds; the fixture runs every action in reverse order after the test, even when
 * earlier actions fail.
 */
export class Teardown {
  readonly #actions: CleanupAction[] = [];
  #closed = false;

  register(name: string, execute: () => Promise<void>): void {
    if (this.#closed) {
      throw new Error(`cannot register cleanup "${name}": teardown already ran`);
    }
    this.#actions.push({ name, execute });
  }

  /** Names of registered actions in execution (LIFO) order. */
  pending(): readonly string[] {
    return this.#actions.map((action) => action.name).reverse();
  }

  async runAll(runStep: StepRunner): Promise<readonly CleanupError[]> {
    this.#closed = true;
    const failures: CleanupError[] = [];
    for (let action = this.#actions.pop(); action; action = this.#actions.pop()) {
      const { name, execute } = action;
      try {
        await runStep(`cleanup: ${name}`, execute);
      } catch (error) {
        failures.push(new CleanupError(name, error));
      }
    }
    return failures;
  }
}

export type TeardownVerdict =
  | { readonly kind: 'clean' }
  /** Cleanup failed but must not fail the test: the test already failed, or policy says report only. */
  | { readonly kind: 'report'; readonly failures: readonly CleanupError[] }
  | { readonly kind: 'fail'; readonly error: TeardownFailedError };

/**
 * A cleanup failure never replaces a primary test failure. It fails an otherwise successful test
 * only when `failOnError` is enabled.
 */
export function teardownVerdict(
  failures: readonly CleanupError[],
  context: { readonly testFailed: boolean; readonly failOnError: boolean },
): TeardownVerdict {
  if (failures.length === 0) {
    return { kind: 'clean' };
  }
  if (context.testFailed || !context.failOnError) {
    return { kind: 'report', failures };
  }
  return { kind: 'fail', error: new TeardownFailedError(failures) };
}
