# bookwright-ts

[![CI](https://github.com/dantro86/bookwright-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dantro86/bookwright-ts/actions/workflows/ci.yml)
[![Allure report](https://img.shields.io/badge/report-Allure-orange)](https://dantro86.github.io/bookwright-ts/)
[![Node.js 24 LTS](https://img.shields.io/badge/node-24%20LTS-339933)](.nvmrc)
[![Playwright](https://img.shields.io/badge/Playwright-1.63-2EAD33)](package.json)

An educational, production-grade test automation framework built with **TypeScript** and
**Playwright Test**. It covers API, UI and database testing with Playwright-native patterns:
fixtures for composition and lifecycle, `APIRequestContext` for HTTP, web-first assertions for UI.
It does not port Java/Guice designs.

> All five roadmap phases are complete. See [`TODO.md`](TODO.md) for the roadmap and acceptance
> checklist, and [`docs/plan.md`](docs/plan.md) for the implementation plan.

## Why this exists

The project teaches how to build a maintainable API + UI + database test system in TypeScript and
shows senior SDET practices in working code:

- Playwright fixtures as the only composition root, with no IoC container and no registry;
- domain-split clients, steps and page objects instead of god objects;
- deterministic, replayable test data and LIFO cleanup that never hides the real failure;
- safe diagnostics: secrets never reach logs, errors, attachments, step titles or traces;
- a real infrastructure path: MySQL only behind a hardened SSH bastion;
- CI with independent gates, coverage, security scanning and a published Allure report.

## Targets

| Track        | Target                                                                         | Status |
| ------------ | ------------------------------------------------------------------------------ | ------ |
| External API | [restful-booker](https://restful-booker.herokuapp.com), Dockerized for `local` | ✅     |
| External UI  | [Sauce Demo](https://www.saucedemo.com)                                        | ✅     |
| Database     | MySQL reachable only through a hardened SSH bastion                            | ✅     |
| Integrated   | Local TypeScript booking app (Fastify) on the same MySQL                       | ✅     |

## Requirements

- Node.js 24 LTS (`nvm use` reads `.nvmrc`)
- Docker with Compose v2 for the `local` stand
- `ssh-keygen` and `ssh-keyscan` (OpenSSH) for the launcher
- Playwright Chromium: `npx playwright install chromium`

## Quick start

```bash
nvm use
npm ci
npx playwright install chromium
npm run test:framework                          # framework self-tests, no services needed
npm run stand:local -- npx playwright test      # the complete suite on an isolated Docker stand
BW_STAND=prod npx playwright test --project=api --project=ui --grep-invert @local-stand
```

## Commands

| Command                                                         | Purpose                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run typecheck`                                             | Strict TypeScript check                                          |
| `npm run lint` / `npm run format:check`                         | ESLint and Prettier                                              |
| `npm run config:check`                                          | Validate configuration for the selected stand                    |
| `npm run test:framework`                                        | Framework self-tests                                             |
| `npm run test:api` / `test:ui` / `test:db` / `test:integration` | One project (needs a configured stand)                           |
| `npm run stand:local -- <command>`                              | Start an isolated local stand, run `<command>`, always tear down |
| `npm run stand:concurrency`                                     | Two complete stands in parallel, proving isolation               |
| `npm run report`                                                | Build and open the Allure report from `allure-results/`          |

Tests of targets that exist only on the local stand are tagged `@local-stand`.

## Documentation

| Guide                                             | Contents                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| [Infrastructure profiles](docs/infrastructure.md) | Stands, launcher, network layout, database settings, non-local profiles |
| [CI guide](docs/ci.md)                            | Jobs, coverage gate, release workflow, Pages and branch protection      |
| [Self-test matrix](docs/self-test-matrix.md)      | Every framework contract and the test that proves it                    |
| [Troubleshooting](docs/troubleshooting.md)        | Configuration, stand, SSH/DB and test diagnostics                       |
| [ADRs](docs/adr)                                  | Architecture decisions and trade-offs                                   |

## Configuration

Settings resolve with precedence **environment > stand > defaults** and are validated with Zod
before any HTTP, browser, SSH or database resource opens. All variables use the `BW_` prefix:

| Variable                                                                 | Default                                                    | Notes                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------- |
| `BW_STAND`                                                               | `local`                                                    | `local` or `prod`                               |
| `BW_RUN_SEED`                                                            | generated per run                                          | Set it to replay deterministic data             |
| `BW_TEARDOWN_FAIL_ON_ERROR`                                              | `true`                                                     | Cleanup failures fail an otherwise passing test |
| `BW_RESTFUL_BOOKER_BASE_URL`                                             | `prod`: public URL; `local`: exported by the launcher      |                                                 |
| `BW_RESTFUL_BOOKER_USERNAME` / `_PASSWORD`                               | `admin` / `password123`                                    | Public restful-booker demo credentials          |
| `BW_RESTFUL_BOOKER_READINESS_TIMEOUT_MS` / `_INTERVAL_MS`                | `60000` / `1000`                                           | Health warm-up polling bounds                   |
| `BW_SAUCE_DEMO_BASE_URL`                                                 | `https://www.saucedemo.com`                                | Same public site on every stand                 |
| `BW_SAUCE_DEMO_STANDARD_USERNAME` / `_LOCKED_OUT_USERNAME` / `_PASSWORD` | `standard_user` / `locked_out_user` / `secret_sauce`       | Published Sauce Demo demo accounts              |
| `BW_LOCAL_APP_BASE_URL`                                                  | exported by the launcher                                   | Local stand only                                |
| `BW_LOCAL_APP_EXISTING_USER_EMAIL` / `_PASSWORD`                         | `demo.user@bookwright.test` / `demo-password-not-a-secret` | Seeded demo account                             |
| `BW_DB_*`                                                                | see [`docs/infrastructure.md`](docs/infrastructure.md)     | SSH bastion and MySQL, local stand only         |

All credentials in this repository are public or local demo values, never production secrets. A
validation failure lists every missing or invalid key with its variable name. Values are never
printed.

## Architecture

```text
framework/
  api/http/                 response contracts and focused errors
  api/restful-booker/       config section + {health,auth,bookings} domains
  api/local/                config section + {auth,users,bookings} domains of the local app
  config/                   section loader, stands, core settings
  db/                       config, SSH tunnel, lazy Database, shutdown + {bookings,rooms} repositories
  diagnostics/              Secret type, centralized redaction, trace sanitizer
  fixtures/                 core + one fixture module per target
  reporting/                Allure labels, replay metadata, safe Allure reporter
  teardown/                 LIFO cleanup queue and verdict policy
  test-data/                deterministic TestData + seeded PRNG
  ui/diagnostics/           independent failure artifacts per page
  ui/saucedemo/             config, catalog + {login,inventory,checkout} page objects
  ui/local/                 {auth,bookings} page objects of the local app
  waiting/                  bounded polling
  test.ts                   the project-level `test` (mergeTests of fixture modules)
local-app/                  Fastify booking app: users, sessions, rooms, bookings (MySQL or memory)
docker/                     compose.yaml, MySQL schema + seed, SSH bastion image
tests/framework/            self-tests (+ scenarios/ for child Playwright runs, support/)
tests/{api,ui,db,integration}/
scripts/                    local-stand launcher, concurrency check, config check
docs/                       plan, infrastructure guide, ADRs
```

Key decisions are recorded in [`docs/adr`](docs/adr):

1. [Fixture composition](docs/adr/0001-fixture-composition.md)
2. [Domain boundaries](docs/adr/0002-domain-boundaries.md)
3. [Deterministic test data](docs/adr/0003-deterministic-test-data.md)
4. [Cleanup ownership](docs/adr/0004-cleanup-ownership.md)
5. [Retry policy](docs/adr/0005-retry-policy.md)
6. [Safe reporting](docs/adr/0006-safe-reporting.md)
7. [API-authenticated UI](docs/adr/0007-api-authenticated-ui.md)
8. [SSH security](docs/adr/0008-ssh-security.md)
9. [Local integrated system](docs/adr/0009-local-integrated-system.md)
10. [Quality gates](docs/adr/0010-quality-gates.md)

### Fixtures

| Fixture                                | Scope  | Provides                                                       |
| -------------------------------------- | ------ | -------------------------------------------------------------- |
| `testData`                             | test   | Deterministic data from run seed + test identity               |
| `teardown`                             | test   | LIFO cleanup queue (`register(name, action)`)                  |
| `restfulBooker`                        | test   | `health`, `auth`, `bookings` clients                           |
| `authSession`                          | test   | Authenticated restful-booker session                           |
| `bookingSteps`, `existingBooking`      | test   | Booking creation with cleanup; a ready booking                 |
| `localApi`                             | test   | Local app `auth`, `users`, `bookings` clients                  |
| `newUser` / `existingUser`             | test   | `TestUser` in `NEW` / `EXISTING` mode                          |
| `testUser` + `userMode` option         | test   | User selected by `test.use({ userMode })`                      |
| `page` (overridden)                    | test   | Playwright's fresh page plus failure diagnostics               |
| `sauceDemo` / `signedInSauceDemo`      | test   | Sauce Demo page objects; anonymous / session injected          |
| `localUi`                              | test   | Local page objects on the anonymous `page`                     |
| `authenticatedPage`, `signedInLocalUi` | test   | Fresh context with `testUser`'s API-issued session             |
| `database`                             | worker | Lazy MySQL access through the SSH bastion: `bookings`, `rooms` |
| `dbBookingSteps`                       | test   | Booking rows written over SSH with cleanup                     |
| `*Config`, `*Request`                  | worker | Validated config sections and request contexts                 |

### Writing a test

```ts
import { localBookingRequest } from '../../framework/api/local/bookings/booking-data.ts';
import { expect, test } from '../../framework/test.ts';

test(
  'created booking is persisted',
  { tag: ['@integration'] },
  async ({ localApi, database, newUser, testData }) => {
    const booking = await localApi.bookings.create(newUser.session, localBookingRequest(testData));
    await expect
      .poll(() => database.bookings.findById(booking.id), {
        message: `booking ${booking.id} to be persisted`,
      })
      .toEqual(booking);
  },
);
```

## Reporting

Allure results go to `allure-results/`. Each test carries epic, feature, owner and severity labels
(`test.use({ reportLabels })`), tags (`@smoke @regression @api @ui @db @integration`), the run seed,
the test seed and an exact replay command. Request/response exchanges are attached after
redaction. Secret input never appears in step titles. A failed UI test gets a screenshot, the HTML,
URL and viewport, console errors, page errors, failed requests and a sanitized trace for every page
it used.

## Framework self-tests

`npm run test:framework` needs no Docker or network. It verifies configuration, deterministic data,
fixture scopes, LIFO cleanup, user modes, response contracts, retries and polling, redaction, UI
artifacts, context isolation, the SSH tunnel, the database lifecycle, repositories, architecture
rules and release tooling. The full mapping from contract to test is in
[`docs/self-test-matrix.md`](docs/self-test-matrix.md). `npm run test:coverage` adds the coverage
gate; `npm run stand:concurrency` proves isolation between complete Docker stands.
