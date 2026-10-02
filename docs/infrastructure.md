# Infrastructure profiles

The framework talks to four targets. Which ones exist, and where, depends on the **stand**
(`BW_STAND`).

| Target                | `local` stand                                         | `prod` stand                           |
| --------------------- | ----------------------------------------------------- | -------------------------------------- |
| restful-booker        | Docker container, dynamic loopback port               | `https://restful-booker.herokuapp.com` |
| Sauce Demo            | public site                                           | public site                            |
| Local booking app     | Docker container, dynamic loopback port               | not available                          |
| MySQL via SSH bastion | Docker containers, bastion on a dynamic loopback port | not available                          |

Tests of targets that exist only locally are tagged `@local-stand`. Run the public subset with:

```bash
BW_STAND=prod npx playwright test --project=api --project=ui --grep-invert @local-stand
```

## The local stand

```bash
npm run stand:local -- npx playwright test                # everything
npm run stand:local -- npx playwright test --project=db   # one project
npm run stand:concurrency                                 # two stands at once, proves isolation
```

`scripts/local-stand.sh`:

1. creates a unique Compose project `bookwright-<epoch>-<pid>`;
2. generates an ed25519 client key in a `0700` temp directory and passes the public half to the
   bastion;
3. builds the local app and the bastion, starts all services with `--wait`. Health checks gate
   startup: MySQL is healthy only after schema and seed are applied;
4. pins the bastion's freshly generated host key with `ssh-keyscan`;
5. discovers the dynamic ports and exports `BW_*` settings, then validates them
   (`scripts/check-config.ts`);
6. runs your command and returns its exit code;
7. always tears down containers, volumes, networks and key material (`EXIT`, `INT`, `TERM`).

Network layout:

```text
host (127.0.0.1:<dynamic>) ─┬─ restful-booker   [edge]
                            ├─ local-app        [edge, backend] ──┐
                            └─ bastion :2222    [edge, backend] ──┴─ mysql:3306 [backend, internal]
```

## Database settings

| Variable                                       | Local default                                                | Notes                              |
| ---------------------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `BW_DB_SSH_HOST` / `BW_DB_SSH_PORT`            | exported by the launcher                                     | Bastion address                    |
| `BW_DB_SSH_USERNAME`                           | `tunnel`                                                     |                                    |
| `BW_DB_SSH_AUTH`                               | `key`                                                        | `password` only for loopback hosts |
| `BW_DB_SSH_PRIVATE_KEY_PATH`                   | exported by the launcher                                     | Required for `key`                 |
| `BW_DB_SSH_KNOWN_HOSTS_PATH`                   | exported by the launcher                                     | Required for non-loopback hosts    |
| `BW_DB_SSH_PASSWORD`                           | unset                                                        | Loopback demo only                 |
| `BW_DB_MYSQL_HOST` / `_PORT`                   | `mysql` / `3306`                                             | As resolved by the bastion         |
| `BW_DB_MYSQL_DATABASE` / `_USER` / `_PASSWORD` | `bookwright` / `bookwright` / `bookwright-demo-not-a-secret` | Demo credentials                   |
| `BW_DB_POOL_SIZE` / `BW_DB_CONNECT_TIMEOUT_MS` | `4` / `10000`                                                |                                    |

## Adding a non-local profile

1. Provide the bastion host and port, a private key file and a `known_hosts` file that contains
   the bastion's host key. Do not use hashed entries; the matcher deliberately ignores them.
2. Point `BW_DB_MYSQL_*` at the database as the bastion resolves it.
3. Run `npm run config:check`. Password authentication and unverified host keys are rejected for
   non-loopback hosts.
4. Store credentials in your secret manager or CI secrets, never in Git.

## Demo: password authentication on loopback

The bastion enables password login only when `BASTION_PASSWORD` is set for the stand:

```bash
BASTION_PASSWORD=demo-password-not-a-secret bash scripts/local-stand.sh \
  env BW_DB_SSH_AUTH=password BW_DB_SSH_PASSWORD=demo-password-not-a-secret npx playwright test --project=db
```
