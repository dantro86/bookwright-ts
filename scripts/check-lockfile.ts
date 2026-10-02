// Lockfile integrity: every package must resolve from the npm registry over HTTPS with an
// integrity hash. `npm ci` separately fails when package.json and the lockfile disagree.
import { readFileSync } from 'node:fs';

interface LockEntry {
  readonly resolved?: string;
  readonly integrity?: string;
  readonly link?: boolean;
}

const REGISTRY = 'https://registry.npmjs.org/';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  lockfileVersion: number;
  packages: Record<string, LockEntry>;
};

const problems: string[] = [];
if (lock.lockfileVersion < 3) {
  problems.push(`lockfileVersion ${lock.lockfileVersion} is older than 3`);
}
for (const [path, entry] of Object.entries(lock.packages)) {
  if (path === '' || entry.link === true) continue;
  if (entry.resolved === undefined || !entry.resolved.startsWith(REGISTRY)) {
    problems.push(`${path}: resolved outside ${REGISTRY} (${entry.resolved ?? 'missing'})`);
  }
  if (entry.integrity === undefined || !entry.integrity.startsWith('sha512-')) {
    problems.push(`${path}: missing sha512 integrity`);
  }
}

if (problems.length > 0) {
  console.error(
    `package-lock.json integrity check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`package-lock.json ok (${Object.keys(lock.packages).length - 1} packages)`);
