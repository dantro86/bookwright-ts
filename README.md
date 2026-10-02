# bookwright-ts

An educational, production-grade test automation framework built with **TypeScript** and
**Playwright Test**. It covers API, UI and database testing with Playwright-native patterns:
fixtures for composition and lifecycle, `APIRequestContext` for HTTP, web-first assertions for UI.
It does not port Java/Guice designs.

> Status: **Phase 2 (fixture runtime and lifecycle)** complete. See [`TODO.md`](TODO.md) for the roadmap and
> [`docs/plan.md`](docs/plan.md) for the implementation plan.

## Targets

| Track        | Target                                                                         | Status  |
| ------------ | ------------------------------------------------------------------------------ | ------- |
| External API | [restful-booker](https://restful-booker.herokuapp.com), Dockerized for `local` | ✅      |
| External UI  | [Sauce Demo](https://www.saucedemo.com)                                        | Phase 3 |
| Database     | MySQL reachable only through an SSH bastion                                    | Phase 4 |
| Integrated   | Local TypeScript booking app (Fastify), in-memory now, MySQL in Phase 4        | API ✅  |

## Requirements

- Node.js 24 LTS (`nvm use` reads `.nvmrc`)
- Docker with Compose v2 for the `local` stand

## Quick start

```bash
nvm use
npm ci
npm run test:framework                                   # framework self-tests, no services needed
npm run stand:local -- npx playwright test --project=api # API tests on an isolated Docker stand
BW_STAND=prod npm run test:api -- --grep-invert @local-stand # restful-booker against the public site
```

## Commands

| Command                                 | Purpose                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| `npm run typecheck`                     | Strict TypeScript check                                          |
| `npm run lint` / `npm run format:check` | ESLint and Prettier                                              |
| `npm run config:check`                  | Validate configuration for the selected stand                    |
| `npm run test:framework`                | Framework self-tests                                             |
| `npm run test:api`                      | API scenarios (needs a configured stand)                         |
| `npm run stand:local -- <command>`      | Start an isolated local stand, run `<command>`, always tear down |
| `npm run report`                        | Build and open the Allure report from `allure-results/`          |

## Configuration

Settings resolve with precedence **environment > stand > defaults** and are validated with Zod
before any HTTP, browser, SSH or database resource opens. All variables use the `BW_` prefix:

| Variable                                                  | Default                                                    | Notes                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `BW_STAND`                                                | `local`                                                    | `local` or `prod`                                              |
| `BW_RUN_SEED`                                             | generated per run                                          | Set it to replay deterministic data                            |
| `BW_TEARDOWN_FAIL_ON_ERROR`                               | `true`                                                     | Cleanup failures fail an otherwise passing test                |
| `BW_RESTFUL_BOOKER_BASE_URL`                              | `prod`: public URL; `local`: exported by the launcher      |                                                                |
| `BW_RESTFUL_BOOKER_USERNAME` / `_PASSWORD`                | `admin` / `password123`                                    | Public restful-booker demo credentials, not production secrets |
| `BW_RESTFUL_BOOKER_READINESS_TIMEOUT_MS` / `_INTERVAL_MS` | `60000` / `1000`                                           | Health warm-up polling bounds                                  |
| `BW_LOCAL_APP_BASE_URL`                                   | exported by the launcher                                   | Local booking app exists only on the `local` stand             |
| `BW_LOCAL_APP_EXISTING_USER_EMAIL` / `_PASSWORD`          | `demo.user@bookwright.test` / `demo-password-not-a-secret` | Seeded demo account, not a production secret                   |

A validation failure lists every missing or invalid key with its variable name. Values are never
printed.

## Architecture

```text
framework/
  api/http/                 response contracts and focused errors
  api/restful-booker/       config section + {health,auth,bookings} domains
  api/local/                config section + {auth,users,bookings} domains of the local app
  config/                   section loader, stands, core settings
  diagnostics/              Secret type and centralized redaction
  fixtures/                 core + per-target fixture modules
  reporting/                Allure labels and replay metadata
  teardown/                 LIFO cleanup queue and verdict policy
  test-data/                deterministic TestData + seeded PRNG
  waiting/                  bounded polling
  test.ts                   the project-level `test` (mergeTests of fixture modules)
local-app/                  Fastify booking app: users, sessions, bookings
tests/framework/            self-tests (+ scenarios/ for child Playwright runs, support/ mock server)
tests/api/{restful-booker,local}/
docker/compose.yaml         local stand
scripts/                    local-stand launcher, config check
docs/adr/                   architecture decision records
```

Key decisions are recorded in [`docs/adr`](docs/adr):

1. [Fixture composition](docs/adr/0001-fixture-composition.md)
2. [Domain boundaries](docs/adr/0002-domain-boundaries.md)
3. [Deterministic test data](docs/adr/0003-deterministic-test-data.md)
4. [Cleanup ownership](docs/adr/0004-cleanup-ownership.md)
5. [Retry policy](docs/adr/0005-retry-policy.md)
6. [Safe reporting](docs/adr/0006-safe-reporting.md)

### Fixtures

| Fixture                           | Scope  | Provides                                         |
| --------------------------------- | ------ | ------------------------------------------------ |
| `testData`                        | test   | Deterministic data from run seed + test identity |
| `teardown`                        | test   | LIFO cleanup queue (`register(name, action)`)    |
| `restfulBooker`                   | test   | `health`, `auth`, `bookings` clients             |
| `authSession`                     | test   | Authenticated restful-booker session             |
| `bookingSteps`, `existingBooking` | test   | Booking creation with cleanup; a ready booking   |
| `localApi`                        | test   | Local app `auth`, `users`, `bookings` clients    |
| `newUser` / `existingUser`        | test   | `TestUser` in `NEW` / `EXISTING` mode            |
| `testUser` + `userMode` option    | test   | User selected by `test.use({ userMode })`        |
| `*Config`, `*Request`             | worker | Validated config sections and request contexts   |

### Writing a test

```ts
import { bookingRequest } from '../../../framework/api/restful-booker/bookings/booking-data.ts';
import { expect, test } from '../../../framework/test.ts';

test(
  'created booking can be read back',
  { tag: ['@api'] },
  async ({ restfulBooker, bookingSteps, testData }) => {
    const request = bookingRequest(testData);
    const created = await bookingSteps.create(request); // registers LIFO cleanup
    await expect(restfulBooker.bookings.requireById(created.bookingid)).resolves.toEqual(request);
  },
);
```

## Reporting

Allure results go to `allure-results/`. Each test carries epic, feature, owner and severity labels
(`test.use({ reportLabels })`), tags (`@smoke @regression @api ...`), the run seed, the test seed and
an exact replay command. Request/response exchanges are attached after redaction.

## Framework self-tests

`npm run test:framework` needs no Docker or network. It covers:

| Area                                                                   | Spec                                         |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| Config precedence, validation, secret settings                         | `config.spec.ts`                             |
| Deterministic data, replay, parallel independence                      | `test-data.spec.ts`, `fixture-scope.spec.ts` |
| Fixture scopes and isolation under parallel workers                    | `fixture-scope.spec.ts`                      |
| LIFO cleanup, `failOnError`, primary failure preserved                 | `teardown.spec.ts`                           |
| `NEW` / `EXISTING` users and their cleanup (in-process local app)      | `user-fixtures.spec.ts`                      |
| Response contracts, error causes, no implicit retries, polling         | `api-contract.spec.ts`, `polling.spec.ts`    |
| Redaction of text, URLs, headers, bodies, objects, errors, attachments | `redaction.spec.ts`, `api-contract.spec.ts`  |
| Architecture rules                                                     | `architecture.spec.ts`                       |

Fixture-runtime behavior is checked in a child Playwright run (`tests/framework/scenarios`), so
scenarios that fail on purpose never fail the outer suite.
