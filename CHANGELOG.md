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
