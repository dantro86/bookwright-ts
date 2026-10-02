# ADR 0009: A small local system for integrated API → DB → UI scenarios

- Status: accepted
- Date: 2026-10-02

## Context

External demo targets cannot show API-to-database verification, user lifecycle management or
API-authenticated UI, because we control neither their storage nor their sessions. The spec asks
for a small local system that is not a showcase product.

## Decision

- `local-app/` is a Fastify app with users, sessions, rooms and bookings, a JSON API and two HTML
  pages. Its persistence port `Store` has two implementations:
  - `MySqlStore` on the Docker stand, using the schema and deterministic seed in
    `docker/mysql/init`;
  - `MemoryStore` for in-process framework self-tests, which need no Docker.
- The app talks to MySQL over the private backend network. Tests reach the same database only
  through the SSH bastion (ADR 0008). This proves that the API and the DB tell the same story.
- Foreign keys cascade user deletion to sessions and bookings. A `CHECK` constraint enforces
  `checkout > checkin`. Booking ids start at 1000, so seeded rows (ids 1–3, archive user) never
  collide with generated ones.
- Repositories (`framework/db/{bookings,rooms}`) validate every row with Zod. They offer required
  lookups (`requireById`, `requireWithRoom`) that throw `RequiredEntityNotFoundError` with entity,
  criterion, query source and count, and optional lookups (`findById`) where absence is expected.
  Totals and nights come from a typed join computed by MySQL.
- Integrated scenarios use explicit `expect.poll` with messages for persistence and removal, and
  register LIFO cleanup for every row written through the tunnel.

## Consequences

- The local app stays small: no admin features, no migrations framework. The schema is plain SQL
  applied by the MySQL entrypoint on a fresh volume for every stand.
- Room data exists twice: in SQL and in `MemoryStore`'s `ROOMS`, mirrored as test expectations.
  The oracle never imports the system under test.
