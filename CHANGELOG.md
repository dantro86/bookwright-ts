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
