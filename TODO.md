# bookwright-ts — Roadmap

Derived from [`docs/typescript-playwright-framework-spec.md`](docs/typescript-playwright-framework-spec.md). Each phase ends in a runnable, documented,
green milestone. Every slice follows the delivery protocol: problem/boundary → affected files →
smallest coherent change → format + typecheck → focused framework tests → affected scenarios →
ADR/README/CHANGELOG updated in the same slice.

## Phase 0: Kickoff

- [x] Inspect the repository, map product domains and lifecycle owners
- [x] Publish a concise implementation plan (`docs/plan.md` or README section)
- [x] Pin Node.js LTS (`.nvmrc`, `engines`), choose current stable versions of all tools

## Phase 1: Foundation

- [x] `package.json`, strict `tsconfig.json`, ESLint (flat config) + Prettier, npm scripts
      (`typecheck`, `lint`, `format:check`, `test:*`)
- [x] `playwright.config.ts` with projects `framework` and `api`; `ui`, `db` and `integration` are
      added by the phases that bring their first tests (no empty projects)
- [x] Typed config: Zod schema, precedence env/CLI > stand > defaults, `local` and `prod` stands,
      one aggregated validation report, values never printed
- [x] Centralized redaction (URLs, headers, bodies, errors, object inspection) + regression tests
- [x] Response-contract layer: `response`, `body<T>(call, status, schema)`, `expectStatus`
- [x] Errors: `ApiCallError`, `UnexpectedResponseError`, `RequiredEntityNotFoundError`,
      `BusinessOperationError` (with `cause`)
- [x] restful-booker domain clients: `health`, `auth`, `bookings` + Zod schemas
- [x] Deterministic `TestData` fixture (run seed + Playwright test identity, parallel-stable)
- [x] Allure Playwright: labels, owner, severity, tags (`@smoke @regression @api @ui @db
@integration`), run seed / test seed / replay command
- [x] Minimal local stand: digest-pinned restful-booker, dynamic port, signal-safe
      `scripts/local-stand.sh` (extended in Phase 4)
- [x] First API tests: health warm-up via bounded polling, auth success/failure, booking CRUD,
      required search with actionable not-found diagnostics
- [x] README skeleton, CHANGELOG (Keep a Changelog), first ADRs (fixture composition, domain
      boundaries, deterministic data)

## Phase 2: Fixture runtime and lifecycle

- [x] Compose one typed `test` export from focused fixture modules (no central registry)
- [x] Worker-scoped: config, safe request contexts (lazy infra handles arrive with SSH/MySQL in
      Phase 4)
- [x] Test-scoped: teardown, test data, steps, scenario fixtures
- [x] LIFO teardown fixture: named Allure steps, `teardown.failOnError`, primary failure preserved,
      cause chains with safe context
- [x] Domain preconditions: `authSession`, `existingBooking`
- [x] Local TypeScript booking app (Fastify): auth, users, sessions, bookings (in-memory store;
      MySQL persistence in Phase 4)
- [x] Local API clients: `auth`, `users`, `bookings`
- [x] `NEW` / `EXISTING` user fixtures (`newUser`, `existingUser`) returning one `TestUser` contract
- [x] Mock HTTP server for disconnect, timeout, malformed JSON, status mismatch,
      eventual-consistency sequences
- [x] Self-tests: config precedence, data replay, fixture scope/isolation, NEW/EXISTING users,
      LIFO + failOnError, no implicit retries, polling + terminal states, redaction
- [x] Architecture rule tests: no catch-all clients/steps, no scenario literals in steps,
      no central fixture catalog
- [x] ADRs: cleanup ownership, retry policy, safe reporting

## Phase 3: UI

- [ ] Sauce Demo page/domain objects: `login`, `inventory`, `checkout` (roles/labels/test IDs,
      scoped locators, web-first assertions)
- [ ] Scenarios: login success, invalid and locked-out, full sorting assertion, scoped product
      selection, cart → checkout → completion with full-state assertions
- [ ] `authenticatedPage`: fresh context with API-issued cookie/storage state
- [ ] Local protected page scenarios: API session login, missing / invalid / expired session
- [ ] Independent failure artifacts: screenshot, HTML, trace, URL + viewport, console errors,
      page errors, failed requests (sanitized; traces discarded on success)
- [ ] Self-tests: independent artifact capture, browser context isolation under concurrency
- [ ] ADR: API-authenticated UI

## Phase 4: Infrastructure and database

- [ ] Docker Compose: digest-pinned MySQL, SSH bastion, restful-booker + local app, private
      network, health checks, dynamic host ports, MySQL without published port
- [ ] Deterministic schema and seed data
- [ ] Lazy SSH tunnel (`ssh2`) with dynamic local port; key + `known_hosts` for non-local,
      password only for loopback demo
- [ ] `mysql2/promise` pool after tunnel; deterministic shutdown order (pool → channel → client)
- [ ] Typed repositories `bookings`, `rooms`: required vs optional lookups, typed join query
- [ ] DB scenarios: seed verification, join query, write/read/delete through tunnel
- [ ] Integrated: API create → DB verify via SSH → API cleanup → DB absence
- [ ] Signal-safe launcher script: unique Compose project, `--wait`, port discovery, exported
      validated config, always tears down (volumes + networks)
- [ ] Self-tests: closure order for page/context, DB pool, SSH tunnel, worker resources;
      concurrent runs with isolated ports/data/users/cleanup
- [ ] ADRs: SSH security, local integrated system; infrastructure profile guide

## Phase 5: Quality system and polish

- [ ] GitHub Actions independent jobs: static quality, self-tests + coverage threshold, API, UI,
      DB-over-SSH, integrated, CodeQL + dependency review, aggregate required status
- [ ] Upload raw results and failure artifacts even on failure; pin actions and images
- [ ] Dependabot, lockfile integrity check
- [ ] Merged, history-enabled Allure report published to GitHub Pages
- [ ] Tag-driven release workflow: tag == package version, full local suite, changelog section
      extraction, GitHub Release, reject `Added Added ...`-style bullets
- [ ] Docs: README (architecture, targets, commands, badges), self-test matrix, CI guide +
      branch protection, troubleshooting guide, remaining ADRs

## Acceptance checklist (spec §12)

- [ ] `npm run typecheck`, lint, format check, self-tests, coverage gate pass
- [ ] Full local Docker suite passes from one documented command
- [ ] API, UI, DB-over-SSH, integrated scenarios run independently in CI
- [ ] Full parallel execution shares no test-owned state
- [ ] New domain fixture requires no central registry change
- [ ] All created entities register LIFO cleanup
- [ ] No product step invents scenario data
- [ ] No arbitrary sleeps or global retries
- [ ] No real secret in Git or diagnostics
- [ ] Required lookups never silently return `undefined`
- [ ] UI tests use native locators and web-first assertions
- [ ] SSH/DB path uses dynamic ports and deterministic shutdown
- [ ] Framework contracts have isolated regression tests
- [ ] Architecture decisions and trade-offs documented
- [ ] No obsolete classes, dead layers, TODO implementations, superseded references
- [ ] `git diff --check` passes, working tree clean after verification
