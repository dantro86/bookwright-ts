import { setTimeout as delay } from 'node:timers/promises';

/**
 * The outcome of one probe. `pending` names the transient state that justifies another attempt;
 * anything that is not transient must be thrown by the probe and fails the poll immediately.
 */
export type ProbeResult<T> =
  | { readonly status: 'done'; readonly value: T }
  | { readonly status: 'pending'; readonly state: string };

export interface PollOptions {
  /** What is being waited for, phrased as a goal: "restful-booker to answer /ping". */
  readonly description: string;
  readonly timeoutMs: number;
  readonly intervalMs: number;
}

export class PollTimeoutError extends Error {
  override readonly name = 'PollTimeoutError';
  readonly attempts: number;
  readonly lastState: string;

  constructor(options: PollOptions, attempts: number, lastState: string, elapsedMs: number) {
    super(
      `Timed out after ${elapsedMs} ms waiting for ${options.description}: ` +
        `${attempts} attempts every ${options.intervalMs} ms, last state "${lastState}"`,
    );
    this.attempts = attempts;
    this.lastState = lastState;
  }
}

export const done = <T>(value: T): ProbeResult<T> => ({ status: 'done', value });
export const pending = (state: string): ProbeResult<never> => ({ status: 'pending', state });

/**
 * Bounded polling for infrastructure warm-up and named transient states. The matched value is
 * returned directly. Errors thrown by the probe are never retried.
 */
export async function pollUntil<T>(
  options: PollOptions,
  probe: () => Promise<ProbeResult<T>>,
): Promise<T> {
  if (options.timeoutMs <= 0 || options.intervalMs <= 0) {
    throw new RangeError('poll timeout and interval must be positive');
  }
  const startedAt = performance.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const result = await probe();
    if (result.status === 'done') {
      return result.value;
    }
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (elapsedMs + options.intervalMs > options.timeoutMs) {
      throw new PollTimeoutError(options, attempts, result.state, elapsedMs);
    }
    await delay(options.intervalMs);
  }
}
