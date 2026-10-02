import { expect, test } from '@playwright/test';
import {
  CleanupError,
  Teardown,
  TeardownFailedError,
  teardownVerdict,
} from '../../framework/teardown/teardown.ts';
import { byTitle, runScenarios, stepTitles } from './support/run-scenarios.ts';

const runStep = (_name: string, body: () => Promise<void>) => body();

test.describe('teardown queue', () => {
  test('runs actions in LIFO order and continues after failures', async () => {
    const teardown = new Teardown();
    const executed: string[] = [];
    teardown.register('a', () => Promise.resolve(void executed.push('a')));
    teardown.register('b', () => Promise.reject(new Error('b failed token=abc')));
    teardown.register('c', () => Promise.resolve(void executed.push('c')));
    expect(teardown.pending()).toEqual(['c', 'b', 'a']);

    const failures = await teardown.runAll(runStep);

    expect(executed).toEqual(['c', 'a']);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toBeInstanceOf(CleanupError);
    expect(failures[0]?.message).toBe('cleanup "b" failed: b failed token=[REDACTED]');
    expect((failures[0]?.cause as Error).message).toBe('b failed token=[REDACTED]');
  });

  test('rejects registration after teardown ran', async () => {
    const teardown = new Teardown();
    await teardown.runAll(runStep);
    expect(() => {
      teardown.register('late', () => Promise.resolve());
    }).toThrow(/teardown already ran/);
  });

  test('verdict: cleanup failure never replaces a primary failure', () => {
    const failures = [new CleanupError('x', new Error('boom'))];
    expect(teardownVerdict([], { testFailed: false, failOnError: true })).toEqual({
      kind: 'clean',
    });
    expect(teardownVerdict(failures, { testFailed: true, failOnError: true }).kind).toBe('report');
    expect(teardownVerdict(failures, { testFailed: false, failOnError: false }).kind).toBe(
      'report',
    );
    const verdict = teardownVerdict(failures, { testFailed: false, failOnError: true });
    expect(verdict.kind).toBe('fail');
    expect(verdict.kind === 'fail' && verdict.error).toBeInstanceOf(TeardownFailedError);
  });
});

test.describe('teardown fixture in a real Playwright run', () => {
  test('failOnError=true: LIFO steps, failing cleanup fails a passing test, primary failures stay primary', async () => {
    const tests = await runScenarios({
      file: 'teardown.scenario.ts',
      env: { BW_RUN_SEED: 'scenario', BW_TEARDOWN_FAIL_ON_ERROR: 'true' },
    });

    const lifo = byTitle(tests, 'lifo order');
    expect(lifo.outcome).toBe('expected');
    expect(stepTitles(lifo.result.steps).filter((title) => title.startsWith('cleanup:'))).toEqual([
      'cleanup: third',
      'cleanup: second',
      'cleanup: first',
    ]);

    const dirty = byTitle(tests, 'passing test with failing cleanup');
    expect(dirty.outcome).toBe('unexpected');
    expect(stepTitles(dirty.result.steps).filter((title) => title.startsWith('cleanup:'))).toEqual([
      'cleanup: after broken',
      'cleanup: broken',
      'cleanup: before broken',
    ]);
    const dirtyErrors = dirty.result.errors.map((error) => error.message ?? '').join('\n');
    expect(dirtyErrors).toContain('TeardownFailedError');
    expect(dirtyErrors).toContain('cleanup "broken" failed');
    expect(dirtyErrors).not.toContain('hunter2');

    const primary = byTitle(tests, 'failing test keeps its primary failure');
    expect(primary.outcome).toBe('unexpected');
    expect(primary.result.errors).toHaveLength(1);
    expect(primary.result.errors[0]?.message).toContain('primary failure');
    expect(primary.annotations).toContainEqual(
      expect.objectContaining({ type: 'cleanup-failure' }),
    );

    const afterAssertion = byTitle(tests, 'cleanup runs after a failed assertion');
    expect(afterAssertion.outcome).toBe('unexpected');
    expect(stepTitles(afterAssertion.result.steps)).toContain('cleanup: release resource');
  });

  test('failOnError=false: cleanup failures are reported, not thrown', async () => {
    const tests = await runScenarios({
      file: 'teardown.scenario.ts',
      env: { BW_RUN_SEED: 'scenario', BW_TEARDOWN_FAIL_ON_ERROR: 'false' },
    });

    const dirty = byTitle(tests, 'passing test with failing cleanup');
    expect(dirty.outcome).toBe('expected');
    expect(dirty.annotations).toContainEqual(
      expect.objectContaining({
        type: 'cleanup-failure',
        description: expect.stringContaining('broken'),
      }),
    );
    expect(dirty.result.attachments.map((attachment) => attachment.name)).toContain(
      'cleanup failures',
    );
  });
});
