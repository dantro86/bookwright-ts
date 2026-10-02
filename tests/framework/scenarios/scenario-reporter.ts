import type { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

/** Prints every scenario with its full step tree (including fixture steps) as JSON on stdout. */
export default class ScenarioReporter implements Reporter {
  readonly #tests: unknown[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    this.#tests.push({
      title: test.title,
      outcome: test.outcome(),
      annotations: [...test.annotations, ...result.annotations],
      result: {
        status: result.status,
        workerIndex: result.workerIndex,
        errors: result.errors.map((error) => ({ message: error.message })),
        steps: result.steps.map((step) => serialize(step)),
        attachments: result.attachments.map((attachment) => ({
          name: attachment.name,
          body: attachment.body?.toString('base64'),
        })),
      },
    });
  }

  onEnd(): void {
    process.stdout.write(JSON.stringify(this.#tests));
  }

  printsToStdio(): boolean {
    return true;
  }
}

function serialize(step: TestStep): unknown {
  return {
    title: step.title,
    ...(step.error && { error: { message: step.error.message } }),
    steps: step.steps.map((child) => serialize(child)),
  };
}
