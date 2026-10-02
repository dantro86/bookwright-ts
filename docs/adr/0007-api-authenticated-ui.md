# ADR 0007: API-authenticated UI and browser lifecycle

- Status: accepted
- Date: 2026-10-02

## Context

Logging in through the form before every protected-page test is slow and repetitive, and it makes
unrelated tests fail when the login form breaks. Sharing one signed-in browser across tests leaks
state between them under parallel execution.

## Decision

- Playwright's `browser` fixture stays the browser lifecycle owner. Every test gets a fresh
  `BrowserContext`, either Playwright's default `page` or a context created by a fixture.
- `authenticatedPage` creates a new context, injects the `testUser`'s API-issued session token as
  the `bw_session` cookie (HttpOnly, SameSite=Lax) and opens a page. It closes the context after
  capturing failure diagnostics. `userMode` selects a `NEW` or `EXISTING` user.
- The local app's JSON API returns tokens in response bodies and never sets cookies. This keeps
  the worker-scoped API request context free of session state. Only the HTML login form sets the
  cookie.
- Form login stays only in tests whose subject is authentication (`form login` scenarios). Missing,
  invalid and expired sessions are verified by redirect target and notice text.
- Sauce Demo keeps its session in a client-side `session-username` cookie. `signedInSauceDemo`
  injects that cookie and opens the inventory, so only the login scenarios use the form.
- Page objects take a `Page` and a base URL and use roles, labels, placeholders and `data-test`
  ids (`testIdAttribute: 'data-test'`). Child controls are scoped to their card or row
  (`inventory.item(name)`, `bookings.row(guestName)`), and nothing is derived from display-text
  slugs. Assertions check complete state: the full catalog in sort order, every line item, all
  totals, every booking row.

## Failure diagnostics

`PageDiagnostics` watches each page it is given: the default `page` through a core fixture
override, and `authenticatedPage` directly. On failure it captures the screenshot, HTML, URL and
viewport, console errors, page errors, failed requests and a trace. Each capture is independent,
and failed captures are listed in one attachment. Text artifacts are redacted. Traces are recorded
per context, stopped and discarded on success, and rewritten by `sanitizeTrace` on failure.
Built-in Playwright tracing is off because it would also record API request headers.

## Consequences

- Screenshots are pixels and cannot be redacted. Pages under test must not render secrets.
- Cleanup closures must not rely on `authenticatedPage`. It is test-scoped and may close before
  `teardown` runs (see ADR 0004).
