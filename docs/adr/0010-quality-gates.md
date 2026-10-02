# ADR 0010: Independent CI jobs behind one quality gate

- Status: accepted
- Date: 2026-10-02

## Context

A single monolithic CI job hides which layer broke and takes the longest path every time. Many
required checks make branch protection brittle when jobs are renamed or split.

## Decision

- Each track runs in its own job on its own isolated stand: static quality, self-tests with
  coverage, the api/ui/db/integration scenarios, concurrent stand isolation, CodeQL and dependency
  review. Jobs fail independently and upload raw results even on failure.
- One aggregate job, **Quality gate**, depends on all of them and is the only required status
  check. Dependency review may be skipped outside pull requests; every other job must succeed.
- The Allure report merges raw results from every job on `main`, keeps history by restoring
  `history.jsonl` from the published site, and is deployed to GitHub Pages even when scenarios
  fail. A red run therefore still produces a readable report.
- The coverage gate (90/90/90/85) applies to the framework core, not to domain clients or page
  objects, which product scenarios exercise against real targets.
- Third-party actions are pinned by SHA and images by digest. Dependabot proposes updates as
  reviewed pull requests.
- Releases are tag-driven. The tag must equal the package version, the complete local suite must
  pass, and release notes come from a linted `CHANGELOG.md` section.

## Consequences

- Renaming or adding jobs does not require changing branch protection; only the gate's `needs`
  list changes.
- Weekly scheduled runs detect drift in public demo targets without blocking day-to-day work.
