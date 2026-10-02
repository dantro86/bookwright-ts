import { expect, test } from '@playwright/test';
import {
  PollTimeoutError,
  done,
  pending,
  pollUntil,
  type ProbeResult,
} from '../../framework/waiting/poll.ts';

test.describe('bounded polling', () => {
  test('returns the matched value directly', async () => {
    const states: ProbeResult<number>[] = [pending('starting'), pending('starting'), done(42)];
    let attempts = 0;
    const value = await pollUntil(
      { description: 'answer', timeoutMs: 1_000, intervalMs: 5 },
      () => {
        const state = states[attempts++];
        return state ? Promise.resolve(state) : Promise.reject(new Error('probe called too often'));
      },
    );
    expect(value).toBe(42);
    expect(attempts).toBe(3);
  });

  test('fails immediately on a non-transient error without retrying', async () => {
    let attempts = 0;
    const poll = pollUntil({ description: 'answer', timeoutMs: 1_000, intervalMs: 5 }, () => {
      attempts++;
      return Promise.reject(new Error('schema mismatch'));
    });
    await expect(poll).rejects.toThrow('schema mismatch');
    expect(attempts).toBe(1);
  });

  test('times out with attempts and the last transient state', async () => {
    const poll = pollUntil({ description: 'service warm-up', timeoutMs: 60, intervalMs: 20 }, () =>
      Promise.resolve(pending('HTTP 503')),
    );
    await expect(poll).rejects.toThrow(PollTimeoutError);
    await expect(poll).rejects.toThrow(
      /waiting for service warm-up: \d+ attempts every 20 ms, last state "HTTP 503"/,
    );
  });

  test('rejects non-positive bounds', async () => {
    const poll = pollUntil({ description: 'x', timeoutMs: 0, intervalMs: 1 }, () =>
      Promise.resolve(done(1)),
    );
    await expect(poll).rejects.toThrow(RangeError);
  });
});
