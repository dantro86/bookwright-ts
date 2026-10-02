import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  extractSection,
  lintSection,
  tagVersion,
  verifyTag,
} from '../../scripts/release/changelog.ts';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Something in progress.

## [1.2.0] - 2031-05-01

### Added

- Teardown policy switch.

### Fixed

- Trace sanitizer keeps binary resources.

## [1.1.0] - 2031-04-01

### Added

- First release.
`;

test.describe('release tooling', () => {
  test('tag must equal the package version', () => {
    expect(tagVersion('v1.2.0')).toBe('1.2.0');
    expect(() => {
      verifyTag('v1.2.0', '1.2.0');
    }).not.toThrow();
    expect(() => {
      verifyTag('v1.2.1', '1.2.0');
    }).toThrow('does not match package.json version 1.2.0');
    expect(() => tagVersion('release-1')).toThrow('is not v<semver>');
  });

  test('extracts exactly one release section', () => {
    expect(extractSection(CHANGELOG, '1.2.0')).toBe(
      '### Added\n\n- Teardown policy switch.\n\n### Fixed\n\n- Trace sanitizer keeps binary resources.',
    );
    expect(() => extractSection(CHANGELOG, '9.9.9')).toThrow(
      'has no "## [9.9.9] - YYYY-MM-DD" section',
    );
  });

  test('rejects bullets that mechanically repeat their heading', () => {
    expect(lintSection(extractSection(CHANGELOG, '1.2.0'))).toEqual([]);
    expect(lintSection('### Added\n\n- Added Added teardown.')).toEqual([
      'bullet repeats its heading "Added": "- Added Added teardown."',
    ]);
    expect(lintSection('### Fixed\n\n- Fixed: flaky poll.')).toHaveLength(1);
    expect(lintSection('### Improvements\n\n- Faster.')).toEqual([
      'unknown heading "### Improvements"',
    ]);
    expect(lintSection('### Added\n')).toEqual(['section has no bullets']);
  });

  test('the repository changelog passes the same lint for its unreleased section', () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const unreleased =
      changelog
        .slice(changelog.indexOf('## [Unreleased]') + '## [Unreleased]'.length)
        .split('\n## ')[0] ?? '';
    expect(lintSection(unreleased)).toEqual([]);
  });
});
