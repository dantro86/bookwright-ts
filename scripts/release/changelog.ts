/** Keep a Changelog section headings, in their conventional order. */
export const CHANGE_TYPES = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
] as const;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Returns the version a `v`-prefixed release tag names, or a problem description. */
export function tagVersion(tag: string): string {
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  if (!SEMVER.test(version)) {
    throw new Error(`tag "${tag}" is not v<semver>`);
  }
  return version;
}

export function verifyTag(tag: string, packageVersion: string): void {
  const version = tagVersion(tag);
  if (version !== packageVersion) {
    throw new Error(`tag ${tag} does not match package.json version ${packageVersion}`);
  }
}

/** The body of `## [version] - YYYY-MM-DD`, up to the next release heading. */
export function extractSection(changelog: string, version: string): string {
  const lines = changelog.split('\n');
  const escaped = version.replaceAll('.', '\\.');
  const header = new RegExp(`^## \\[${escaped}\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`);
  const start = lines.findIndex((line) => header.test(line));
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no "## [${version}] - YYYY-MM-DD" section`);
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
}

/**
 * Release notes must be written for humans: known headings only, at least one bullet, and no
 * bullet that mechanically repeats its heading ("### Added" → "- Added Added …" or "- Added …").
 */
export function lintSection(section: string): readonly string[] {
  const problems: string[] = [];
  let heading: string | undefined;
  let bullets = 0;
  for (const line of section.split('\n')) {
    const headingMatch = /^### (.+?)\s*$/.exec(line);
    if (headingMatch) {
      heading = headingMatch[1];
      if (!CHANGE_TYPES.includes(heading as (typeof CHANGE_TYPES)[number])) {
        problems.push(`unknown heading "### ${heading}"`);
      }
      continue;
    }
    const bulletMatch = /^- (\S+)/.exec(line);
    if (!bulletMatch) continue;
    bullets += 1;
    if (heading === undefined) {
      problems.push(`bullet outside a heading: "${line}"`);
      continue;
    }
    const firstWord = bulletMatch[1]?.replace(/[:.,]$/, '');
    if (firstWord?.toLowerCase() === heading.toLowerCase()) {
      problems.push(`bullet repeats its heading "${heading}": "${line}"`);
    }
  }
  if (bullets === 0) {
    problems.push('section has no bullets');
  }
  return problems;
}
