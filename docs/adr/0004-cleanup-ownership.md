# ADR 0004: Cleanup ownership and the LIFO teardown fixture

- Status: accepted
- Date: 2026-10-02

## Context

Tests create users, sessions and bookings. If cleanup is skipped after a failure, data leaks and
later runs flake. If a cleanup failure is reported instead of the real assertion error, debugging
gets harder.

## Decision

- `teardown` is a test-scoped fixture that holds a LIFO queue of `{ name, execute }` actions.
- The code that creates state registers its cleanup immediately after the creation succeeds.
  Steps (`BookingSteps`, `UserSteps`, `LocalBookingSteps`) and preconditions (`existingBooking`,
  `newUser`, `existingUser`) do this, never tests or `afterEach` hooks.
- Cleanup actions query first and act second (`deleteIfPresent`), so a scenario that already
  deleted its entity does not fail its own cleanup.
- Every action runs inside a named `cleanup: <name>` step and the queue keeps going after a
  failure. Failures become `CleanupError`s with sanitized causes.
- The verdict is a pure function (`teardownVerdict`):
  - test failed → cleanup failures are reported (annotation + attachment) and never thrown, so the
    primary failure stays primary;
  - test passed and `BW_TEARDOWN_FAIL_ON_ERROR=true` (default) → `TeardownFailedError` fails it;
  - test passed and `BW_TEARDOWN_FAIL_ON_ERROR=false` → report only.
- Cleanup closures may only use worker-scoped request contexts and data they captured. Test-scoped
  resources declared after `teardown` may already be gone when it runs.

## Consequences

- Cleanup order is the reverse of creation, so dependent entities (a booking) go before their
  owners (a user).
- Self-tests drive the real fixture through a child Playwright run
  (`tests/framework/scenarios`) and assert on step order, outcomes and annotations.
