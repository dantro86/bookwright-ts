import type { APIRequestContext } from '@playwright/test';
import { test } from '@playwright/test';
import { requireStatus, response, type ApiCall } from '../../http/contract.ts';
import { ApiCallError } from '../../http/errors.ts';
import { done, pending, pollUntil, type ProbeResult } from '../../../waiting/poll.ts';

/** Gateway statuses a starting container may answer with while the app is not yet listening. */
const WARMING_UP_STATUSES = new Set([502, 503, 504]);

export interface ReadinessPolicy {
  readonly timeoutMs: number;
  readonly intervalMs: number;
}

export class HealthClient {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  /**
   * Classifies one `/ping`. Transport failures and gateway warm-up statuses are transient; any other
   * unexpected status is a contract failure and throws.
   */
  async probe(): Promise<ProbeResult<'up'>> {
    const call: ApiCall = {
      request: this.#request,
      operation: 'ping',
      method: 'GET',
      path: '/ping',
    };
    try {
      const res = await response(call);
      if (res.status() === 201) {
        return done('up');
      }
      if (WARMING_UP_STATUSES.has(res.status())) {
        return pending(`HTTP ${res.status()}`);
      }
      await requireStatus(call, res, 201);
      return done('up');
    } catch (error) {
      if (error instanceof ApiCallError) {
        return pending('unreachable');
      }
      throw error;
    }
  }

  async waitUntilReady(policy: ReadinessPolicy): Promise<void> {
    await test.step('wait until restful-booker is ready', () =>
      pollUntil({ description: 'restful-booker to answer /ping with 201', ...policy }, () =>
        this.probe(),
      ));
  }
}
