# ADR 0001: Playwright fixtures as the only composition root

- Status: accepted
- Date: 2026-10-02

## Context

The framework needs dependency injection and lifecycle management for configuration, API
contexts, test data and (later) browsers, SSH tunnels and database pools. Java frameworks reach for
Guice or a hand-written registry. Playwright Test already provides typed fixtures with worker and
test scopes, dependency declarations and deterministic teardown.

## Decision

- Every target or concern owns one fixture module in `framework/fixtures/` that extends `core`.
- `framework/test.ts` merges those modules with `mergeTests` and is the single `test` export.
- Worker scope holds validated configuration and request contexts that carry no per-test state.
  Test scope holds clients, test data, preconditions and anything mutable.
- Preconditions (`authSession`, later `existingBooking`, `newUser`) are fixtures that a test
  requests by parameter name. There is no string-keyed context bag.
- Report labels are a Playwright option fixture (`test.use({ reportLabels })`), applied by an auto
  fixture.

## Consequences

- Adding a target means adding one module and one entry in `mergeTests`. No switch, catalog or
  type-to-factory map is edited.
- Fixture names share one namespace, so modules prefix target-specific fixtures
  (`restfulBookerConfig`, `restfulBookerRequest`).
- No IoC container. Plain functions and classes stay testable without Playwright.
