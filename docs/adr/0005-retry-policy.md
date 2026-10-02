# ADR 0005: No implicit retries; explicit waiting boundaries

- Status: accepted
- Date: 2026-10-02

## Context

Hidden retries make suites look stable while they hide real defects and double-submit
non-idempotent requests. Real systems still need waiting: services warm up, and data becomes
visible eventually.

## Decision

- `retries: 0` in Playwright config. Every API call passes `maxRetries: 0` and runs exactly once.
  A mock-server self-test counts requests to prove it.
- Waiting happens only at named boundaries:
  - infrastructure warm-up: `pollUntil({ description, timeoutMs, intervalMs }, probe)`. The probe
    returns `done(value)` or `pending('<named transient state>')`. Anything thrown fails
    immediately, so schema errors, authentication failures and terminal states are never retried.
    The matched value is returned directly.
  - eventual consistency in scenarios: `expect.poll(fn, { message })` with a mandatory message.
  - UI (Phase 3): web-first assertions and locator auto-waiting.
- Classifying statuses as transient or terminal is a named domain method's job, for example
  `HealthClient.probe`, which treats transport failures and 502/503/504 as transient.
- ESLint forbids `waitForTimeout`. An architecture self-test rejects sleeps outside
  `framework/waiting` and any retry configuration.

## Consequences

- A flaky dependency surfaces as a clear `PollTimeoutError` listing attempts and the last state,
  not as an intermittent pass.
