# ADR 0002: Domain boundaries for API clients

- Status: accepted
- Date: 2026-10-02

## Context

Catch-all `ApiClient` or `ApiSteps` classes grow without bound and couple unrelated areas. The
spec asks for target- and domain-split clients that use `APIRequestContext` directly.

## Decision

- Layout: `framework/api/<target>/<domain>/`. Each domain owns its client, Zod schemas, data
  builders and stable expectations. Example: `restful-booker/bookings/{bookings-client,
booking-schemas, booking-data}.ts`.
- One client class per functional area (`HealthClient`, `AuthClient`, `BookingsClient`). A target
  access point (`restfulBooker.health | auth | bookings`) groups them and nothing else.
- Clients describe each request as an `ApiCall` and run it through the response-contract layer
  (`response`, `body`, `expectStatus`, `readBody`, `requireStatus`). There is no generic HTTP
  wrapper over `APIRequestContext`.
- Mutating operations go through `businessOperation(...)`, which wraps failures in
  `BusinessOperationError` with safe context and the original `cause`.
- Lookups come in two named flavors. Required lookups (`requireById`, `requireIdBy`) throw
  `RequiredEntityNotFoundError` with entity, criterion, source and count. Optional lookups
  (`findById`) return `undefined` only where absence is an expected contract.
- Target quirks are classified in the domain. restful-booker returns HTTP 200 for rejected
  credentials, so `AuthClient.requestToken` returns a typed `granted | rejected` outcome.

## Consequences

- New domains are new folders. Existing clients do not grow.
- Domain-specific test data lives with the domain (`bookingRequest(testData)`), not inside the
  shared `TestData`.
