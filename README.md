# bookwright-ts

An educational, production-grade test automation framework built with **TypeScript** and
**Playwright Test**. It covers API, UI and database testing with Playwright-native patterns:
fixtures for composition and lifecycle, `APIRequestContext` for HTTP, web-first assertions for UI.
It does not port Java/Guice designs.

> Status: **Phase 1 (foundation)** complete. See [`TODO.md`](TODO.md) for the roadmap and
> [`docs/plan.md`](docs/plan.md) for the implementation plan.

## Targets

| Track        | Target                                                                         | Status    |
| ------------ | ------------------------------------------------------------------------------ | --------- |
| External API | [restful-booker](https://restful-booker.herokuapp.com), Dockerized for `local` | ✅        |
| External UI  | [Sauce Demo](https://www.saucedemo.com)                                        | Phase 3   |
| Database     | MySQL reachable only through an SSH bastion                                    | Phase 4   |
| Integrated   | Local TypeScript booking app on the same MySQL                                 | Phase 2–4 |

## Requirements

- Node.js 24 LTS (`nvm use` reads `.nvmrc`)
- Docker with Compose v2 for the `local` stand

## Quick start

```bash
nvm use
npm ci
npm run test:framework                                   # framework self-tests, no services needed
npm run stand:local -- npx playwright test --project=api # API tests on an isolated Docker stand
BW_STAND=prod npm run test:api                           # API tests against public restful-booker
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

| Variable                                                  | Default                                               | Notes                                                          |
| --------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `BW_STAND`                                                | `local`                                               | `local` or `prod`                                              |
| `BW_RUN_SEED`                                             | generated per run                                     | Set it to replay deterministic data                            |
| `BW_TEARDOWN_FAIL_ON_ERROR`                               | `true`                                                | Used by LIFO teardown (Phase 2)                                |
| `BW_RESTFUL_BOOKER_BASE_URL`                              | `prod`: public URL; `local`: exported by the launcher |                                                                |
| `BW_RESTFUL_BOOKER_USERNAME` / `_PASSWORD`                | `admin` / `password123`                               | Public restful-booker demo credentials, not production secrets |
| `BW_RESTFUL_BOOKER_READINESS_TIMEOUT_MS` / `_INTERVAL_MS` | `60000` / `1000`                                      | Health warm-up polling bounds                                  |

A validation failure lists every missing or invalid key with its variable name. Values are never
printed.

## Architecture

```text
framework/
  api/http/                 response contracts and focused errors
  api/restful-booker/       config section + {health,auth,bookings} domains
  config/                   section loader, stands, core settings
  diagnostics/              Secret type and centralized redaction
  fixtures/                 core + per-target fixture modules
  reporting/                Allure labels and replay metadata
  test-data/                deterministic TestData + seeded PRNG
  waiting/                  bounded polling
  test.ts                   the project-level `test` (mergeTests of fixture modules)
tests/{framework,api}/
docker/compose.yaml         local stand
scripts/                    local-stand launcher, config check
docs/adr/                   architecture decision records
```

Key decisions are recorded in [`docs/adr`](docs/adr):

1. [Fixture composition](docs/adr/0001-fixture-composition.md)
2. [Domain boundaries](docs/adr/0002-domain-boundaries.md)
3. [Deterministic test data](docs/adr/0003-deterministic-test-data.md)

### Writing a test

```ts
import { bookingRequest } from '../../../framework/api/restful-booker/bookings/booking-data.ts';
import { expect, test } from '../../../framework/test.ts';

test('created booking can be read back', { tag: ['@api'] }, async ({ restfulBooker, testData }) => {
  const request = bookingRequest(testData);
  const created = await restfulBooker.bookings.create(request);
  await expect(restfulBooker.bookings.requireById(created.bookingid)).resolves.toEqual(request);
});
```

## Reporting

Allure results go to `allure-results/`. Each test carries epic, feature, owner and severity labels
(`test.use({ reportLabels })`), tags (`@smoke @regression @api ...`), the run seed, the test seed and
an exact replay command. Request/response exchanges are attached after redaction.
