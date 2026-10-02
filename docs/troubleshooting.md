# Troubleshooting

## Configuration

**`Invalid configuration for "<section>" on stand "<stand>"`**: the message lists every missing
or invalid key with its environment variable. Values are never printed. Common causes:

- `local` stand without the launcher: run through `npm run stand:local -- <command>`, or choose
  `BW_STAND=prod` for public targets only;
- `target is not available on this stand`: the test needs the local app or the database. Exclude
  those tests with `--grep-invert @local-stand`;
- `password authentication is allowed only for loopback hosts`: use key authentication with
  `BW_DB_SSH_PRIVATE_KEY_PATH` and `BW_DB_SSH_KNOWN_HOSTS_PATH`.

Check any stand without running tests: `BW_STAND=<stand> npm run config:check`.

## Local stand

- **Startup is slow on Apple Silicon.** The restful-booker image is `linux/amd64` only and runs
  under emulation. Allow about 20–30 s.
- **`compose up` times out.** Run `docker compose ls -a`, then inspect a service with
  `docker compose -p <project> logs <service>`. MySQL becomes healthy only after schema and seed
  are applied.
- **`could not read the bastion host key`**: the bastion did not answer `ssh-keyscan`. Check
  `docker compose -p <project> logs bastion`.
- **A stand was left behind** (for example after `kill -9`): `docker compose ls -a`, then
  `docker compose -p <project> down --volumes --remove-orphans`. Key material lives in
  `${TMPDIR}/bookwright-stand.*` and can be deleted.

## Database and SSH

- **`SSH connect to 127.0.0.1:<port> failed: … Handshake failed` or a host-key mismatch**:
  `known_hosts` does not contain the presented key. Each stand has a fresh host key, so never
  reuse a `known_hosts` file across stands.
- **`query "<name>" failed`**: the message names the repository query. A schema mismatch lists
  the failing row paths without values.
- **`RequiredEntityNotFoundError`**: a required lookup found 0 rows, or more than 1. The message
  names entity, criterion, query source and count. Use the optional lookup (`findById`) only
  where absence is expected.

## Tests

- **Reproduce generated data.** Every Allure result has a `replay command` attachment, for
  example `BW_RUN_SEED=<seed> npx playwright test tests/api/…:<line> --project=api`.
- **Cleanup failures.** By default they fail an otherwise green test (`TeardownFailedError`). With
  `BW_TEARDOWN_FAIL_ON_ERROR=false` they are reported as a `cleanup-failure` annotation instead. A
  test that already failed keeps its own error as the primary failure.
- **UI failure artifacts.** Look for the `page …` and `authenticated page …` attachments:
  screenshot, HTML, location, console errors, page errors, failed requests and a sanitized trace
  (`npx playwright show-trace <file>`). If a capture failed, `artifact capture failures` explains
  why.
- **Sauce Demo or restful-booker unavailable.** These are public demo services. The weekly CI
  run surfaces drift. Locally, use the Docker restful-booker (`local` stand).

## Coverage

`npm run test:coverage` fails below the thresholds in `.c8rc.json`. Open
`coverage/lcov-report/index.html` for uncovered lines.
