import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import {
  captureIndependently,
  type Attach,
} from '../../framework/ui/diagnostics/page-diagnostics.ts';
import { byTitle, runScenarios, type ScenarioTest } from './support/run-scenarios.ts';

const ARTIFACTS = [
  'screenshot',
  'html',
  'location',
  'console errors',
  'page errors',
  'failed requests',
  'trace',
];
const LEAKS = ['markup-leak-123', 'console-leak-123', 'pageerror-leak-123', 'request-leak-123'];

function attachment(scenario: ScenarioTest, name: string): { body?: string; path?: string } {
  const found = scenario.result.attachments.find((candidate) => candidate.name === `page ${name}`);
  if (!found)
    throw new Error(
      `attachment "page ${name}" missing; got ${scenario.result.attachments.map((a) => a.name).join(', ')}`,
    );
  return found;
}

function text(scenario: ScenarioTest, name: string): string {
  return Buffer.from(attachment(scenario, name).body ?? '', 'base64').toString('utf8');
}

test.describe('independent UI failure artifacts', () => {
  test('a failing capturer does not prevent the others', async () => {
    const attached: string[] = [];
    const attach: Attach = (name) => {
      attached.push(name);
      return Promise.resolve();
    };

    const failures = await captureIndependently(
      [
        { name: 'first', capture: () => Promise.resolve({ body: 'a', contentType: 'text/plain' }) },
        { name: 'broken', capture: () => Promise.reject(new Error('boom password=hunter2')) },
        { name: 'last', capture: () => Promise.resolve({ body: 'b', contentType: 'text/plain' }) },
      ],
      attach,
      'page',
    );

    expect(attached).toEqual(['page first', 'page last', 'page artifact capture failures']);
    expect(failures).toEqual(['broken: boom password=[REDACTED]']);
  });

  test('failed UI tests get every artifact, sanitized; passing tests get none', async () => {
    const tests = await runScenarios({ file: 'artifacts.scenario.ts', workers: 3 });

    const failed = byTitle(tests, 'failing UI test');
    expect(failed.outcome).toBe('unexpected');
    for (const name of ARTIFACTS) {
      expect(attachment(failed, name), name).toBeDefined();
    }
    expect(text(failed, 'console errors')).toContain('console says token=[REDACTED]');
    expect(text(failed, 'page errors')).toContain('page error with token=[REDACTED]');
    expect(text(failed, 'failed requests')).toContain(
      'GET http://127.0.0.1:9/unreachable?token=[REDACTED]',
    );
    expect(JSON.parse(text(failed, 'location'))).toMatchObject({
      viewport: { width: 1280, height: 720 },
      closed: false,
    });
    for (const name of ['console errors', 'page errors', 'failed requests', 'html']) {
      for (const leak of LEAKS)
        expect(text(failed, name), `${name} leaks ${leak}`).not.toContain(leak);
    }

    const tracePath = attachment(failed, 'trace').path;
    if (tracePath === undefined) throw new Error('trace attachment has no path');
    const entries = unzipSync(new Uint8Array(await readFile(tracePath)));
    expect(Object.keys(entries).some((name) => name.endsWith('.trace'))).toBe(true);
    for (const [name, content] of Object.entries(entries)) {
      const decoded = strFromU8(content, true);
      for (const leak of LEAKS)
        expect(decoded.includes(leak), `trace entry ${name} leaks ${leak}`).toBe(false);
    }

    const passed = byTitle(tests, 'passing UI test');
    expect(passed.outcome).toBe('expected');
    expect(passed.result.attachments.filter((a) => a.name.startsWith('page '))).toEqual([]);
  });

  test('a closed page still yields the artifacts that do not need it', async () => {
    const tests = await runScenarios({ file: 'artifacts.scenario.ts', workers: 3 });

    const closed = byTitle(tests, 'closed page still yields the remaining artifacts');
    expect(closed.outcome).toBe('unexpected');
    for (const name of ['location', 'console errors', 'page errors', 'failed requests', 'trace']) {
      expect(attachment(closed, name), name).toBeDefined();
    }
    const failures = text(closed, 'artifact capture failures');
    expect(failures).toMatch(/^screenshot: /m);
    expect(failures).toMatch(/^html: /m);
    expect(JSON.parse(text(closed, 'location'))).toMatchObject({ closed: true });
  });
});
