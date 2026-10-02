# ADR 0008: Database access only through a hardened SSH bastion

- Status: accepted
- Date: 2026-10-02

## Context

Real production databases are rarely reachable directly. Tests must exercise the same path an
engineer would use: an SSH bastion with key authentication and host-key verification, without
weakening it for convenience and without leaking credentials.

## Decision

- MySQL publishes no port and lives on an `internal` Docker network. The bastion is the only
  container on both the edge and backend networks that tests can reach.
- The bastion (`docker/bastion`, built from a digest-pinned Alpine) allows local forwarding
  only: `PermitOpen mysql:3306`, `AllowTcpForwarding local`, no shell (`ForceCommand /bin/false`),
  no TTY, no agent or X11 forwarding, no root login, one user (`tunnel`).
- Each stand generates a fresh client key pair (`ssh-keygen -t ed25519`) and the bastion generates
  a fresh host key. The launcher pins that host key with `ssh-keyscan` into a stand-private
  `known_hosts`. All key material lives in a `0700` temp directory that teardown deletes.
- The tunnel (`framework/db/ssh-tunnel.ts`, `ssh2`) verifies the presented host key against
  `known_hosts`. Hashed and marker entries never match, so verification fails closed. The tunnel
  forwards from a loopback port the OS allocates (`listen(0)`), so parallel workers and stands
  never collide.
- Configuration rules, enforced in one aggregated report:
  - `key` authentication requires a private key path and a `known_hosts` path;
  - `password` authentication is allowed only for loopback hosts (local demo, `BASTION_PASSWORD`);
  - skipping host-key verification is allowed only for loopback hosts.
- Shutdown order is deterministic: MySQL pool, then forwarded channels, then the SSH client.
  `shutdownInOrder` continues after failures and reports every failed step.

## Consequences

- The local stand's security was verified by hand: password login is denied, a shell is refused,
  forwarding to any target other than `mysql:3306` is prohibited, and an unknown host key is
  rejected. Self-tests repeat the host-key and client-key checks against an in-process SSH server.
- A non-local profile only has to provide the bastion address, a private key and a pinned
  `known_hosts`. See `docs/infrastructure.md`.
