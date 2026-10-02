import { expect, test } from '@playwright/test';
import { runScenarios, type ScenarioTest } from './support/run-scenarios.ts';

interface Probe {
  readonly title: string;
  readonly workerIndex: number;
  readonly workerToken: string;
  readonly testToken: string;
  readonly data: string;
  readonly pendingCleanup: readonly string[];
}

function probes(tests: readonly ScenarioTest[]): Probe[] {
  return tests.map((scenario) => {
    expect(scenario.outcome, scenario.title).toBe('expected');
    const attachment = scenario.result.attachments.find(({ name }) => name === 'probe');
    if (attachment?.body === undefined)
      throw new Error(`probe attachment missing for ${scenario.title}`);
    return JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8')) as Probe;
  });
}

test.describe('fixture scopes under parallel execution', () => {
  test('worker fixtures are shared per worker, test fixtures are isolated per test', async () => {
    const results = probes(
      await runScenarios({ file: 'scope.scenario.ts', workers: 3, env: { BW_RUN_SEED: 'scope' } }),
    );

    expect(results).toHaveLength(8);
    const workerTokens = new Map<number, Set<string>>();
    for (const probe of results) {
      workerTokens.set(
        probe.workerIndex,
        (workerTokens.get(probe.workerIndex) ?? new Set()).add(probe.workerToken),
      );
      expect(probe.pendingCleanup).toEqual([`${probe.title} cleanup`]);
    }
    for (const tokens of workerTokens.values()) {
      expect(tokens.size).toBe(1);
    }
    expect(new Set(results.map((probe) => probe.testToken)).size).toBe(8);
    expect(new Set(results.map((probe) => probe.data)).size).toBe(8);
  });

  test('generated data does not depend on worker count or scheduling', async () => {
    const [serial, parallel] = await Promise.all([
      runScenarios({ file: 'scope.scenario.ts', workers: 1, env: { BW_RUN_SEED: 'replay' } }),
      runScenarios({ file: 'scope.scenario.ts', workers: 4, env: { BW_RUN_SEED: 'replay' } }),
    ]);
    const dataByTitle = (tests: readonly ScenarioTest[]) =>
      Object.fromEntries(probes(tests).map((probe) => [probe.title, probe.data]));

    expect(dataByTitle(parallel)).toEqual(dataByTitle(serial));
  });
});
