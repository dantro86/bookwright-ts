// Usage: node scripts/release/release-notes.ts 1.2.3 > notes.md — prints the linted CHANGELOG section.
import { readFileSync } from 'node:fs';
import { extractSection, lintSection } from './changelog.ts';

const [version] = process.argv.slice(2);
try {
  const section = extractSection(readFileSync('CHANGELOG.md', 'utf8'), version ?? '');
  const problems = lintSection(section);
  if (problems.length > 0) {
    throw new Error(
      `release notes for ${version ?? ''} are not publishable:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  process.stdout.write(`${section}\n`);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
