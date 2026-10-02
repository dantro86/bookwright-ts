// Usage: node scripts/release/verify-tag.ts v1.2.3 — fails unless the tag equals package.json version.
import { readFileSync } from 'node:fs';
import { verifyTag } from './changelog.ts';

const [tag] = process.argv.slice(2);
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
try {
  verifyTag(tag ?? '', version);
  console.log(`tag ${tag ?? ''} matches package.json version ${version}`);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
