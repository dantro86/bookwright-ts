import { redactText, sanitizeError } from '../diagnostics/redaction.ts';

/** An infrastructure step (SSH connect, forwarding, pool start, shutdown) failed. */
export class InfrastructureError extends Error {
  override readonly name = 'InfrastructureError';
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    const safeCause = sanitizeError(cause);
    super(`${operation} failed: ${safeCause.message}`, { cause: safeCause });
    this.operation = operation;
  }
}

/** Shutdown continued past failures; every failed step is listed. */
export class ShutdownError extends Error {
  override readonly name = 'ShutdownError';
  readonly failures: readonly InfrastructureError[];

  constructor(failures: readonly InfrastructureError[]) {
    super(
      [
        `${failures.length} shutdown step(s) failed:`,
        ...failures.map((f) => `  - ${redactText(f.message)}`),
      ].join('\n'),
      { cause: failures[0] },
    );
    this.failures = failures;
  }
}
