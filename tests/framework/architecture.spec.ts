import { expect, test } from '@playwright/test';
import { globSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

interface SourceFile {
  readonly path: string;
  readonly text: string;
}

function sources(pattern: string): SourceFile[] {
  return globSync(pattern)
    .sort()
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

function offenders(
  files: readonly SourceFile[],
  predicate: (file: SourceFile) => boolean,
): string[] {
  return files.filter(predicate).map((file) => file.path);
}

const framework = sources('framework/**/*.ts');

test.describe('architecture rules', () => {
  test('no catch-all clients, steps or page-action classes', () => {
    const forbidden =
      /\b(class|interface|type)\s+(ApiClient|ApiSteps|ApplicationApi|PageActions|BaseApi|CommonSteps|Helpers?)\b/;
    expect(offenders(framework, (file) => forbidden.test(file.text))).toEqual([]);
    expect(
      offenders(framework, (file) =>
        /^(api|helpers?|utils?|common)\.ts$/i.test(basename(file.path)),
      ),
    ).toEqual([]);
  });

  test('API clients live in framework/api/<target>/<domain>/', () => {
    const clients = framework.filter((file) => file.path.endsWith('-client.ts'));
    expect(clients.length).toBeGreaterThan(0);
    for (const client of clients) {
      expect(client.path, 'client location').toMatch(
        /^framework\/api\/[a-z-]+\/[a-z-]+\/[a-z-]+-client\.ts$/,
      );
      const classes = client.text.match(/^export class \w+/gm) ?? [];
      expect(classes, `${client.path} owns exactly one client class`).toHaveLength(1);
    }
  });

  test('steps never invent scenario data', () => {
    const steps = framework.filter((file) => file.path.endsWith('-steps.ts'));
    expect(steps.length).toBeGreaterThan(0);
    const scenarioLiteral = [
      /Secret\.of\(/, // credentials come from config or TestData, never from steps
      /['"`][^'"`\s]+@[^'"`\s]+\.[a-z]{2,}['"`]/i, // email addresses
      /\b(password|firstname|lastname|email|guestName)\s*:\s*['"`]/i, // literal payload fields
      /testData\./, // steps receive built data; they do not generate it
    ];
    expect(
      offenders(steps, (file) => scenarioLiteral.some((pattern) => pattern.test(file.text))),
    ).toEqual([]);
  });

  test('no central fixture catalog: test.ts only merges fixture modules', () => {
    const root = readFileSync('framework/test.ts', 'utf8');
    const imports = [...root.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(
      imports.every((source) => source === '@playwright/test' || source?.startsWith('./fixtures/')),
    ).toBe(true);
    expect(root).toMatch(/export const test = mergeTests\(/);
  });

  test('fixture modules extend core and never import each other', () => {
    const modules = sources('framework/fixtures/*.ts').filter(
      (file) => !file.path.endsWith('/core.ts'),
    );
    expect(modules.length).toBeGreaterThan(0);
    for (const module of modules) {
      expect(module.text, `${module.path} extends core`).toMatch(
        /import \{ test as core \} from '\.\/core\.ts'/,
      );
      const siblings = [...module.text.matchAll(/from '\.\/([^']+)'/g)].map((match) => match[1]);
      expect(siblings, `${module.path} sibling imports`).toEqual(['core.ts']);
    }
  });

  test('no arbitrary sleeps outside the polling boundary', () => {
    const all = [...framework, ...sources('tests/**/*.ts'), ...sources('local-app/**/*.ts')];
    const sleeps = /waitForTimeout\(|timers\/promises|new Promise\(\s*\(?\w*\)?\s*=>\s*setTimeout/;
    expect(
      offenders(all, (file) => sleeps.test(file.text) && file.path !== 'framework/waiting/poll.ts'),
    ).toEqual([]);
  });

  test('no implicit retries anywhere', () => {
    expect(readFileSync('playwright.config.ts', 'utf8')).toMatch(/retries: 0,/);
    const retrying = /maxRetries:\s*[1-9]|retries:\s*[1-9]|\.retry\(/;
    expect(
      offenders([...framework, ...sources('tests/**/*.ts')], (file) => retrying.test(file.text)),
    ).toEqual([]);
  });
});
