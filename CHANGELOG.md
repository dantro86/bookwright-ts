# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Strict TypeScript project on Node.js 24 LTS with ESLint (flat config, type-checked rules) and
  Prettier.
- Playwright Test configuration with `framework` and `api` projects, no retries, Allure reporting.
- Zod-validated configuration sections with `environment > stand > defaults` precedence, `local`
  and `prod` stands, and one aggregated validation report that never prints values.
- `Secret` type and centralized redaction for text, URLs, headers, bodies, objects and errors.
- Response-contract layer (`response`, `body`, `expectStatus`) with focused error types.
- restful-booker clients for `health`, `auth` and `bookings`.
- Deterministic `TestData` derived from the run seed and Playwright test identity, with Allure
  replay metadata.
- Bounded polling for infrastructure warm-up.
- Local Docker stand with a digest-pinned restful-booker and a signal-safe launcher using dynamic
  ports.
- Framework self-tests for configuration, test data, redaction and polling. API scenarios for
  health, authentication, the booking lifecycle and required search.
- ADRs 0001–0003 and the implementation plan.
- LIFO `teardown` fixture with named cleanup steps, `BW_TEARDOWN_FAIL_ON_ERROR` policy and
  preservation of the primary failure.
- restful-booker `BookingSteps` and `existingBooking` precondition with query-first cleanup.
- Local Fastify booking app (users, sessions, bookings) in the Docker stand, with API clients
  for `auth`, `users` and `bookings`.
- `newUser`, `existingUser` and `testUser` (`userMode` option) fixtures returning one `TestUser`
  contract.
- Local app API scenarios: registration, sessions (missing, invalid, expired, logout), bookings
  in both user modes, cross-user isolation.
- Mock HTTP server and self-tests for response contracts, disconnects, timeouts, malformed JSON,
  status mismatches, eventual consistency and no implicit retries.
- Fixture runtime self-tests in child Playwright runs (cleanup order and policy, scope isolation,
  scheduling-independent data), in-process user fixture tests and architecture rule tests.
- ADRs 0004–0006: cleanup ownership, retry policy, safe reporting.
- `ui` project with Sauce Demo page objects (login, inventory, checkout) and scenarios: login
  success, wrong password, locked-out user, all four sort orders against the complete catalog,
  scoped product selection, and cart to checkout to completion with full totals.
- Local app HTML pages (`/login`, `/bookings`, `/logout`) with cookie sessions, and scenarios for
  API-authenticated pages in both user modes, sign-out, and missing, invalid and expired sessions.
- `authenticatedPage` / `signedInLocalUi` (API-issued session cookie in a fresh context) and
  `signedInSauceDemo` (injected session cookie) fixtures.
- `PageDiagnostics`: independent screenshot, HTML, location, console errors, page errors, failed
  requests and sanitized trace on failure, nothing on success.
- Trace sanitizer, redaction of name/value header and cookie pairs, `TestData.sample`.
- `fillSecret` and a safe Allure reporter that masks secret input values in step titles.
- Configuration sections can declare the stands they exist on; `config:check` skips the others.
- Self-tests for artifact capture independence and sanitization, and for browser context
  isolation under concurrency.
- ADR 0007: API-authenticated UI.

- MySQL 8.4 (digest-pinned, no published port, `internal` network) with deterministic schema and
  seed, and a hardened SSH bastion image (forwarding to `mysql:3306` only, no shell, fresh host
  key per stand).
- Launcher generates a per-stand SSH client key, pins the bastion host key with `ssh-keyscan` and
  deletes all key material on teardown; `stand:concurrency` runs two stands in parallel.
- `ssh2` tunnel on a dynamic loopback port with `known_hosts` verification; lazy worker-scoped
  `database` fixture opening tunnel then pool, closing pool, channels, client in order.
- Typed `bookings` and `rooms` repositories with required/optional lookups and a typed join.
- Database configuration rules: key auth needs key + `known_hosts`; password auth and unverified
  host keys only for loopback hosts. Sections can declare cross-field checks.
- `db` and `integration` projects: seed verification, typed join, write/read/delete over SSH,
  API → DB → API delete → DB absence, SSH-written row served by API and UI, cascade on user delete.
- Self-tests: SSH tunnel against an in-process SSH server, database lifecycle and shutdown order,
  configuration security rules, page/context closure order.
- ADRs 0008 (SSH security) and 0009 (local integrated system); infrastructure guide.

### Changed

- Built-in Playwright tracing and screenshots are off. Traces are captured per page and sanitized,
  because built-in traces also recorded raw API request headers.
- The local app keeps expired sessions, so later requests keep reporting `session_expired`.
- The launcher runs long steps in the background and forwards `INT`/`TERM`, so a signal tears the
  stand down immediately instead of after the running command finishes.
- The local app persists to MySQL on the stand through an async `Store` port; the in-memory store
  remains for in-process self-tests.
