# Implementation plan

Source of truth: [`typescript-playwright-framework-spec.md`](typescript-playwright-framework-spec.md).
Progress is tracked in [`TODO.md`](../TODO.md).

## Starting point

The repository started empty. There is no legacy code to migrate, so every module is introduced by
the slice that first needs it. No placeholder modules are created ahead of time.

## Product domains and lifecycle owners

| Target                                            | Domains                                 | Transport                                                                     | Lifecycle owner                 |
| ------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| restful-booker (external API, Docker for `local`) | `health`, `auth`, `bookings`            | worker-scoped `APIRequestContext`                                             | `restful-booker` fixture module |
| Sauce Demo (external UI)                          | `login`, `inventory`, `checkout`        | test-scoped `Page` from Playwright                                            | Playwright browser fixtures     |
| Local booking app (Fastify, in this repo)         | `auth`, `users`, `sessions`, `bookings` | worker-scoped `APIRequestContext`, test-scoped authenticated `BrowserContext` | `local` fixture module          |
| MySQL behind an SSH bastion                       | `bookings`, `rooms`                     | lazy worker-scoped SSH tunnel + `mysql2` pool                                 | `database` fixture module       |

Cross-cutting owners:

| Concern                        | Owner                   | Scope     |
| ------------------------------ | ----------------------- | --------- |
| Validated configuration        | `framework/config`      | worker    |
| Deterministic test data        | `framework/test-data`   | test      |
| LIFO cleanup queue             | `framework/teardown`    | test      |
| Redaction and safe diagnostics | `framework/diagnostics` | stateless |
| Response contracts and errors  | `framework/api/http`    | stateless |
| Bounded polling                | `framework/waiting`     | stateless |

## Key decisions up front

- **Playwright fixtures are the only composition root.** Each target ships its own fixture module;
  `framework/test.ts` merges them with `mergeTests`. No registry, no IoC container.
- **Thin domain clients over `APIRequestContext`.** One class per functional area. Response
  contracts (`response`, `body`, `expectStatus`) validate status and Zod schemas and raise focused
  errors with redacted context.
- **Determinism.** One run seed per run (generated in the runner process, inherited by workers,
  overridable through `BW_RUN_SEED`) combined with Playwright's stable `testId`.
- **No hidden retries.** `maxRetries: 0` on every call, `retries: 0` in config. Waiting happens only
  at named polling boundaries.
- **Configuration.** Zod-validated, `environment > stand > defaults`, `local` and `prod` stands,
  secrets wrapped in a `Secret` type that cannot leak through `toString`, JSON or `util.inspect`.
- **Tooling.** Node.js 24 LTS, TypeScript 6.0 (the latest line supported by `typescript-eslint`;
  TypeScript 7 is not yet supported by the lint toolchain), Playwright Test, Allure Playwright,
  Zod 4, ESLint flat config + Prettier.

## Phases

Each phase ends green, documented, and committed. See `TODO.md` for the checklist.

1. **Foundation**: tooling, config, redaction, response contracts, restful-booker clients,
   deterministic data, Allure, first API tests, minimal local stand with restful-booker.
2. **Fixture runtime and lifecycle**: composed fixtures, LIFO teardown, preconditions, local
   Fastify app, NEW/EXISTING users, mock server, framework self-tests.
3. **UI**: Sauce Demo page objects, API-authenticated UI, failure artifacts.
4. **Infrastructure and database**: full Docker stand, SSH tunnel, MySQL repositories, integrated
   scenario.
5. **Quality system**: CI, coverage, security, Allure Pages, release workflow, documentation.

## Known constraints

- The published `mwinteringham/restfulbooker` image is `linux/amd64` only; on Apple Silicon it runs
  under emulation (`platform: linux/amd64`).
- restful-booker answers failed authentication with HTTP 200 and `{ "reason": "Bad credentials" }`;
  the `auth` domain classifies this explicitly instead of relying on the status code.
