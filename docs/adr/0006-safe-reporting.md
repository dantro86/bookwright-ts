# ADR 0006: Safe reporting and centralized redaction

- Status: accepted
- Date: 2026-10-02

## Context

Diagnostics such as error messages, Allure attachments and logs are shared widely. They must
contain enough context to act on and never contain credentials, tokens or session ids.

## Decision

- Secret-bearing values are `Secret` instances. `toString`, `toJSON` and `util.inspect` return
  `[REDACTED]`. Only `reveal()` returns the raw value, and it is called at the transport boundary
  (request body or header).
- Every `Secret` is remembered so free-text redaction scrubs it when a server echoes it back.
- `framework/diagnostics/redaction.ts` is the single redaction module. It masks sensitive URL
  parameters and userinfo, headers by name, object keys at any depth, credential-shaped text
  (`Bearer`, `password=`, private keys), and error messages, stacks and causes.
- Bodies are rendered only for JSON, form-encoded and plain text, and are bounded to 2,000 chars.
  Unknown or malformed formats are omitted, never attached raw.
- The contract layer attaches a redacted request/response exchange to every API call step. Errors
  carry operation, method, redacted URL, expected/actual status and a redacted bounded body.
- Configuration errors name keys and variables, never values (Zod `reportInput: false`).

## Consequences

- Redaction is regression-tested (`tests/framework/redaction.spec.ts`,
  `api-contract.spec.ts`).
- Playwright traces are not yet sanitized. Phase 3 must handle them before traces are kept for UI
  failures.
