# ADR 0003: Deterministic test data

- Status: accepted
- Date: 2026-10-02

## Context

Random data finds bugs, but a failure must be reproducible. Parallel scheduling must not change
which values a test receives.

## Decision

- The runner process generates one run seed (`BW_RUN_SEED`, overridable) in
  `playwright.config.ts`. Workers inherit it through the environment.
- Each test's seed is `sha256(runSeed / testInfo.testId / repeatEachIndex)`. `testId` is stable
  for a project, file and title path and does not depend on worker or order.
- `TestData` wraps a sfc32 PRNG seeded from that digest and exposes domain-neutral primitives
  (`token`, `unique`, names, numbers, date ranges). Dates come from a fixed origin, never from the
  wall clock.
- Uniqueness across parallel tests comes from `unique(prefix)`, a seeded 32-bit hex token.
- Allure records the run seed and test seed as excluded parameters, so history is not split, plus
  a `replay command` attachment such as
  `BW_RUN_SEED=<seed> npx playwright test <file>:<line> --project=<project>`.

## Consequences

- Replaying with the same seed reproduces the exact payloads. Against a shared external service,
  reruns can collide with data left behind by the earlier run. LIFO cleanup ([ADR 0004](0004-cleanup-ownership.md)) addresses
  this.
- Renaming a test changes its `testId` and therefore its data. This is accepted.
