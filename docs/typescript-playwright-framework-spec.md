# Technical Specification: TypeScript + Playwright Test Automation Framework

## 1. Assignment for the coding agent

Design and implement a production-grade educational test automation framework using TypeScript and
Playwright Test. The framework must provide the same engineering capabilities as bookwright while
using native TypeScript and Playwright Test concepts instead of copying Java, JUnit, or Guice
patterns mechanically.

The result is intended to serve two purposes:

1. demonstrate senior SDET architecture and quality-engineering practices;
2. teach engineers how to build a maintainable API + UI + database test system in TypeScript.

All source code, comments, documentation, test names, logs, errors, and release notes must be in
English.

Before implementation, inspect the complete repository, map the product domains and lifecycle
owners, and publish a concise implementation plan. Work in small verified slices. Do not create
empty abstractions, placeholder implementations, or speculative enterprise layers.

## 2. Required stack

Use current stable, mutually compatible versions of:

- Node.js LTS;
- TypeScript with strict mode enabled;
- Playwright Test as the test runner, UI driver, API client, fixture runtime, parallel-execution
  engine, and primary assertion library;
- Allure Playwright for reporting;
- Zod for runtime configuration validation;
- `mysql2/promise` for MySQL access;
- `ssh2` for SSH tunneling;
- Docker Compose for the deterministic local stand;
- ESLint and Prettier for static quality;
- Vitest only if isolated framework unit tests are materially clearer outside Playwright Test.
  Prefer Playwright Test unless a second runner has a demonstrated benefit.

Do not add an IoC container. Playwright fixtures are the dependency-injection and lifecycle system.
Do not wrap Playwright `Page`, `Locator`, `APIRequestContext`, or assertions behind generic driver,
element, request, or response interfaces.

## 3. Demonstration targets

The framework must exercise four tracks:

| Track             | Target                                                                |
| ----------------- | --------------------------------------------------------------------- |
| External API      | restful-booker, with a Dockerized local profile                       |
| External UI       | Sauce Demo                                                            |
| Database          | MySQL reachable only through an SSH bastion                           |
| Integrated system | A small local TypeScript booking application backed by the same MySQL |

The local booking application should expose authentication, users, sessions, and bookings. It may
use Fastify or another small, well-maintained TypeScript HTTP framework. It exists to demonstrate
API-to-database verification, API-authenticated UI, user lifecycle management, and cleanup; it must
not become a separate showcase product.

## 4. Architectural principles

### 4.1 Native Playwright composition

Build one typed project-level `test` export by composing focused Playwright fixture modules. Use
Playwright fixture dependency declarations and scopes as the composition root:

- worker-scoped: validated configuration, API request contexts where safe, browser-managed shared
  resources, and lazily opened infrastructure handles;
- test-scoped: teardown queue, deterministic test data, domain steps, authenticated context/page,
  scenario fixtures, and mutable test-owned state;
- Playwright's own browser fixture remains the browser lifecycle owner;
- every test receives a fresh `BrowserContext` and `Page` unless a scenario explicitly proves a
  different lifecycle contract.

Avoid one global fixture registry. A domain fixture must be declared beside its owner and composed
through fixture modules. Adding a new fixture must not require editing a central switch, catalog, or
type-to-factory map.

Example target usage:

```ts
import { test, expect } from '../../framework/test';

test('created booking is persisted', async ({ localApi, database, newUser, testData }) => {
  const booking = await localApi.bookings.create(newUser.session, testData.booking());
  await expect
    .poll(() => database.bookings.requireById(booking.id), {
      message: `booking ${booking.id} to be persisted`,
    })
    .toMatchObject(booking);
});
```

### 4.2 Domain boundaries

API clients, steps, fixtures, and models must be split by target and product domain. Do not create a
catch-all `ApplicationApi`, `ApiClient`, `ApiSteps`, or `PageActions` god object.

Use a structure equivalent to:

```text
framework/
  api/
    restful-booker/{health,auth,bookings}/
    local/{auth,users,bookings}/
  ui/
    saucedemo/{login,inventory,checkout}/
    local/{bookings}/
  db/{bookings,rooms}/
```

Top-level access points may expose targets and domains, but must remain compact:

```ts
api.restfulBooker.health;
api.restfulBooker.auth;
api.restfulBooker.bookings;
api.local.auth;
api.local.users;
api.local.bookings;
ui.sauceDemo.login;
ui.sauceDemo.inventory;
ui.sauceDemo.checkout;
ui.local.bookings;
```

Each API class owns one functional area. Steps orchestrate business operations and Allure steps but
do not construct scenario-specific credentials or payloads.

### 4.3 Typed fixtures and test data

Keep stable scenario expectations in immutable, domain-owned fixture objects. Generate unique data
through one deterministic `TestData` fixture.

Requirements:

- no usernames, passwords, emails, roles, project names, booking payloads, or expected UI texts
  invented inside steps;
- no scenario-specific literals scattered through product tests;
- fixture values are immutable and typed;
- secret-bearing models implement safe serialization and never reveal raw secrets through logs,
  error messages, attachments, snapshots, or object inspection;
- generated data is derived from a configurable run seed and the stable Playwright test identity;
- parallel scheduling must not change generated values;
- Allure records the run seed, test seed, and exact replay command.

### 4.4 Preconditions and typed state

Model preconditions as domain-owned Playwright fixtures with explicit dependencies. A test requests
the prepared state through its typed fixture parameter; setup runs before the body and cleanup runs
after `use()`.

Examples:

- `authSession` authenticates restful-booker and returns a typed `AuthSession`;
- `existingBooking` creates a booking through the API, registers cleanup, and returns the created
  model;
- `newUser` creates a unique local user, authenticates it, registers cleanup, and returns typed
  credentials, profile, and session;
- `existingUser` reads configured credentials, authenticates them, and returns the same typed shape;
- `authenticatedPage` creates a fresh browser context and injects the API-issued cookie or storage
  state before opening the protected UI.

Do not use string-keyed global state or an untyped test context bag. Do not use exceptions as normal
find-or-create control flow. Query first, inspect the result, then create only when absent.

### 4.5 Cleanup

Implement a test-scoped LIFO teardown fixture:

```ts
type CleanupAction = {
  name: string;
  execute: () => Promise<void>;
};
```

Requirements:

- steps and preconditions register cleanup immediately after creating state;
- actions run in reverse order;
- `teardown.failOnError=true|false` controls whether cleanup failures fail an otherwise successful
  test;
- a cleanup failure must never replace the primary test failure;
- all cleanup actions appear as named Allure steps;
- cleanup errors preserve their cause and safe business context;
- cleanup state is test-scoped and safe under full parallel execution.

### 4.6 API transport and diagnostics

Use `APIRequestContext` directly through thin domain clients. Create a small response-contract layer,
not a generic HTTP framework.

Provide equivalents of:

```ts
response(call): Promise<APIResponse>
body<T>(call, expectedStatus, schema): Promise<T>
expectStatus(call, expectedStatus): Promise<void>
```

Use Zod schemas at important response boundaries. Introduce focused errors:

- `ApiCallError` for transport failures;
- `UnexpectedResponseError` for HTTP contract failures;
- `RequiredEntityNotFoundError` for required searches;
- `BusinessOperationError` for create/update/delete operations, preserving the original error as
  `cause`.

Safe diagnostics should include operation, method, sanitized URL, expected/actual status, and a
sanitized bounded response body. Never expose authorization headers, cookies, tokens, passwords,
session IDs, private keys, or sensitive query/body fields.

Redaction must be centralized and regression-tested. Unknown or malformed body formats must be
omitted rather than attached unsafely.

Do not enable invisible global request retries. Every API call executes once unless a step uses an
explicit polling boundary.

### 4.7 Waiting policy

- UI: use Playwright web-first assertions and locator auto-waiting;
- API eventual consistency: use `expect.poll` with a mandatory diagnostic message;
- infrastructure warm-up: use bounded polling with explicit timeout and interval;
- never use `page.waitForTimeout`, arbitrary sleeps, mutable holders, arrays, or atomics as result
  channels;
- return the matched value directly when polling resolves it;
- retry only named transient states or transport failures;
- programming errors, schema failures, authentication failures, and terminal business states must
  fail immediately;
- terminal/error-state classification belongs in named domain methods.

### 4.8 UI design and failure artifacts

Use plain Playwright locators based on roles, labels, test IDs, and visible domain text. Scope child
controls to their owning card, row, or dialog. Do not derive selector slugs from display text.

Page/domain objects should expose focused actions and state reads. Keep assertions near the domain
when reusable; product tests should still express the business outcome clearly.

On UI failure, attach independently so one failed capture does not block the others:

- screenshot;
- current page HTML;
- Playwright trace;
- current URL and viewport;
- bounded console errors;
- page errors;
- failed network requests.

Discard traces for successful tests. Sanitize every attachment.

Assertions must validate meaningful complete state: full sorted collections, cart contents,
checkout overview, final URL, completion message, and relevant counts—not one representative item.

### 4.9 User management and API-authenticated UI

Support explicit `NEW` and `EXISTING` user modes through typed fixtures.

- `NEW`: generate deterministic unique registration data, create the user through the API,
  authenticate through the API, and register cleanup;
- `EXISTING`: load credentials from validated configuration and authenticate through the API;
- both modes return the same `TestUser` contract;
- inject the API-issued cookie, local storage value, or storage state into a fresh Playwright
  context;
- unrelated protected-page scenarios must not repeatedly submit a login form;
- retain form login only for tests whose subject is authentication UI;
- verify missing, invalid, and expired sessions;
- prove isolation under parallel execution.

### 4.10 Configuration and secrets

Implement typed configuration with this precedence:

```text
explicit process environment / CLI override
> stand-specific configuration
> documented non-secret defaults
```

Use Zod to validate all required values before opening HTTP, browser, SSH, or database resources.
Support at least `prod` and `local` stands.

Rules:

- no real secrets in Git;
- local demo passwords must be clearly documented as non-production credentials;
- logs and validation errors may name a missing key but must never print its value;
- fail fast with one actionable validation report listing all missing/invalid settings;
- non-local SSH requires private-key authentication and `known_hosts` verification;
- password authentication and disabled host-key checking are allowed only for the loopback local
  demo.

### 4.11 Database over SSH

MySQL must not publish a host port. Tests reach it only through the SSH bastion.

Implement:

- lazy SSH tunnel creation;
- a dynamically allocated local forwarding port;
- `mysql2/promise` pool creation after the tunnel is ready;
- typed repositories for bookings and rooms;
- required lookup methods that throw `RequiredEntityNotFoundError` with entity, criterion, query
  source, and returned count;
- optional lookup methods only where absence is an expected contract;
- deterministic shutdown of DB pool, SSH channel, and SSH client;
- parallel local runs without fixed-port collisions.

### 4.12 Deterministic local stand

Docker Compose must provide:

- digest-pinned MySQL;
- digest-pinned SSH bastion;
- digest-pinned restful-booker;
- the local TypeScript booking application;
- deterministic schema and seed data;
- explicit service health checks;
- a private network;
- dynamic host ports for exposed API and SSH services;
- automatic cleanup including volumes and networks.

Provide one launcher script that creates a unique Compose project, starts services with `--wait`,
discovers published ports, exports validated runtime configuration, executes the selected test task,
and always tears the environment down through a signal-safe trap.

## 5. Reporting and metadata

Integrate Allure Playwright and provide:

- epic/feature/story or equivalent domain labels;
- owner metadata;
- severity where useful;
- named steps for business operations, preconditions, waits, and cleanup;
- request/response attachments after redaction;
- deterministic-data replay metadata;
- UI failure artifacts;
- environment metadata without secrets;
- merged report history published to GitHub Pages.

Use a small tag taxonomy such as `@smoke`, `@regression`, `@api`, `@ui`, `@db`, and `@integration`.
Do not create one annotation/helper file per feature or owner.

## 6. Framework self-tests

Create deterministic tests of the framework itself, independent from product availability.

At minimum verify:

- configuration precedence and validation;
- deterministic test-data replay and parallel independence;
- fixture scope and dependency isolation;
- NEW/EXISTING user fixture behavior;
- LIFO cleanup and `failOnError` policy;
- preservation of a primary failure;
- API response helpers and error cause chains;
- no implicit HTTP retries;
- explicit polling and terminal-state handling;
- secret redaction in URLs, headers, bodies, errors, logs, object serialization, and Allure data;
- required/optional entity lookup contracts;
- independent UI artifact capture;
- browser context isolation under concurrency;
- deterministic closure order for page/context, DB pool, SSH tunnel, and worker resources;
- architecture rules preventing catch-all clients/steps, scenario literals in steps, and a central
  fixture catalog.

Use a local mock HTTP server for disconnects, timeouts, malformed JSON, status mismatches, and
eventual-consistency sequences.

## 7. CI quality gates

Create independent GitHub Actions jobs for:

1. static quality: TypeScript typecheck, ESLint, Prettier check, configuration validation;
2. framework self-tests and coverage threshold;
3. API scenarios against the local stand;
4. UI scenarios;
5. DB-over-SSH scenarios;
6. integrated API/UI/DB scenarios;
7. security: CodeQL and dependency review;
8. one required aggregate quality status;
9. merged Allure report generation and GitHub Pages publication.

Upload raw test results and failure artifacts even when a scenario job fails. Pin GitHub Actions and
container images deliberately. Add Dependabot and lockfile integrity checks.

## 8. Versioning and documentation

Use Semantic Versioning and Keep a Changelog. Add a tag-driven release workflow that:

- verifies tag and package version equality;
- runs the complete deterministic local suite;
- extracts one release section from `CHANGELOG.md`;
- creates a GitHub Release;
- rejects release bullets that mechanically repeat headings such as `Added Added ...`.

Required documentation:

- README with architecture, targets, commands, badges, and educational intent;
- framework self-test matrix;
- CI guide and required branch-protection checks;
- infrastructure profile guide;
- troubleshooting guide;
- ADRs for fixture composition, domain boundaries, cleanup ownership, retry policy, safe reporting,
  deterministic data, SSH security, API-authenticated UI, and local integrated system.

## 9. Suggested repository layout

```text
.
├── framework/
│   ├── api/
│   │   ├── restful-booker/{health,auth,bookings}/
│   │   └── local/{auth,users,bookings}/
│   ├── ui/
│   │   ├── saucedemo/{login,inventory,checkout}/
│   │   └── local/bookings/
│   ├── db/{bookings,rooms}/
│   ├── fixtures/{core,restful-booker,saucedemo,local,database}/
│   ├── config/
│   ├── diagnostics/
│   ├── teardown/
│   ├── test-data/
│   └── test.ts
├── tests/{api,ui,db,integration,framework}/
├── local-app/
├── docker/
├── scripts/
├── docs/adr/
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.js
├── package.json
├── CHANGELOG.md
└── README.md
```

Folders may be adjusted when implementation evidence justifies it. Preserve ownership boundaries,
not the diagram mechanically.

## 10. Required demonstration scenarios

### API

- health warm-up using explicit polling;
- authentication success and failure;
- booking create/read/update/partial-update/delete;
- required booking search with actionable not-found diagnostics;
- cleanup after setup and after a failed assertion;
- malformed JSON, timeout, disconnect, and unexpected status through a mock server.

### UI

- successful Sauce Demo login;
- invalid and locked-out login;
- complete inventory sorting assertion;
- product selection by visible scoped locator;
- cart-to-checkout-to-completion flow;
- local protected page opened through an API-created browser session;
- missing and invalid session rejection;
- one intentional framework self-test proving failure artifacts are independently captured.

### Database and integration

- deterministic seed verification;
- typed join query between bookings and rooms;
- write/read/delete through the SSH tunnel;
- API create → DB verification through SSH → API cleanup → DB absence verification;
- concurrent test runs with isolated ports, data, users, contexts, and cleanup queues.

## 11. Implementation phases

Each phase must end in a runnable, documented, green milestone.

### Phase 1: foundation

- strict TypeScript project;
- Playwright projects and config validation;
- domain API clients and response contracts;
- deterministic test data;
- first local API tests;
- Allure integration.

### Phase 2: fixture runtime and lifecycle

- composed typed Playwright fixtures;
- domain-owned preconditions;
- LIFO teardown policy;
- NEW/EXISTING user management;
- framework self-tests for scope and parallel isolation.

### Phase 3: UI

- focused page/domain objects;
- API-authenticated browser contexts;
- Sauce Demo and local protected-page scenarios;
- traces, screenshots, HTML, console, page, and network diagnostics.

### Phase 4: infrastructure and database

- deterministic Docker stand;
- secure SSH profiles and dynamic forwarding;
- typed MySQL repositories;
- integrated API → DB → cleanup scenario;
- signal-safe local runner.

### Phase 5: quality system and portfolio polish

- independent CI gates and aggregate status;
- coverage and security checks;
- merged history-enabled Allure Pages report;
- ADRs, README, guides, versioning, changelog, and release workflow.

## 12. Acceptance criteria

The assignment is complete only when all statements below are true:

- `npm run typecheck`, lint, formatting check, framework self-tests, and coverage gate pass;
- the complete local Docker suite passes from one documented command;
- API, UI, DB-over-SSH, and integrated scenarios run independently in CI;
- full parallel execution does not share test-owned state;
- adding a new domain fixture requires no central registry change;
- all created entities register LIFO cleanup;
- no product step invents scenario data;
- no arbitrary sleeps or global retries exist;
- no real secret exists in Git or appears in diagnostics;
- required entity lookups never return `undefined` silently;
- UI tests use native locators and web-first assertions;
- the SSH/database path uses dynamic ports and deterministic shutdown;
- framework contracts have isolated regression tests;
- architecture decisions and trade-offs are documented;
- the repository has no obsolete classes, dead compatibility layers, TODO implementations, or
  references to superseded architecture;
- `git diff --check` passes and the working tree is clean after verification.

## 13. Coding-agent delivery protocol

For every implementation slice:

1. state the current architectural problem and intended boundary;
2. list files and owners affected;
3. implement the smallest coherent slice;
4. format and typecheck;
5. run focused framework tests;
6. run affected product scenarios;
7. run the full deterministic suite before release;
8. update ADR, README, roadmap, and changelog in the same slice;
9. report architecture decisions, changed files, exact commands, test results, and remaining risks.

Do not claim success from compilation alone. Do not weaken tests, disable parallelism, add retries,
or broaden exception handling merely to make a failing build green. Diagnose and fix the violated
contract.
