#!/usr/bin/env bash
# Starts an isolated local stand, runs one command against it and always tears it down.
#
#   scripts/local-stand.sh npx playwright test --project=api
#
# Each invocation uses a unique Compose project with dynamic host ports, a freshly generated SSH
# client key and a pinned bastion host key, so concurrent runs on one machine do not collide.
# Teardown removes containers, volumes, networks and key material on success, failure, Ctrl+C and
# SIGTERM.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 64
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${root_dir}/docker/compose.yaml"
project="bookwright-$(date +%s)-$$"
secrets_dir="$(mktemp -d "${TMPDIR:-/tmp}/bookwright-stand.XXXXXX")"
chmod 0700 "${secrets_dir}"

compose() {
  docker compose --file "${compose_file}" --project-name "${project}" "$@"
}

teardown() {
  local status=$?
  trap - EXIT INT TERM
  echo "local-stand: tearing down ${project}" >&2
  compose down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1 ||
    echo "local-stand: teardown of ${project} failed; inspect with 'docker compose ls'" >&2
  rm -rf "${secrets_dir}"
  exit "${status}"
}
# Bash defers traps until a foreground command returns, so long-running steps run in the
# background and are awaited with the interruptible `wait`; signals are forwarded to them.
child_pid=""
on_signal() {
  if [[ -n "${child_pid}" ]]; then
    kill -TERM "${child_pid}" 2>/dev/null || true
    wait "${child_pid}" 2>/dev/null || true
  fi
  exit "$1"
}
run_interruptible() {
  "$@" &
  child_pid=$!
  local status=0
  wait "${child_pid}" || status=$?
  child_pid=""
  return "${status}"
}
trap teardown EXIT
trap 'on_signal 130' INT
trap 'on_signal 143' TERM

published_port() {
  local mapping
  mapping="$(compose port "$1" "$2")"
  echo "${mapping##*:}"
}

ssh-keygen -q -t ed25519 -N '' -C "${project}" -f "${secrets_dir}/id_ed25519"
export BASTION_AUTHORIZED_KEY
BASTION_AUTHORIZED_KEY="$(cat "${secrets_dir}/id_ed25519.pub")"

echo "local-stand: starting ${project}" >&2
run_interruptible compose up --detach --wait --wait-timeout 240 --quiet-pull --build

ssh_port="$(published_port bastion 2222)"
# Pin the host key generated inside this stand's bastion; the tunnel refuses any other key.
ssh-keyscan -q -t ed25519 -p "${ssh_port}" 127.0.0.1 >"${secrets_dir}/known_hosts"
if [[ ! -s "${secrets_dir}/known_hosts" ]]; then
  echo "local-stand: could not read the bastion host key" >&2
  exit 1
fi

export BW_STAND=local
export BW_RESTFUL_BOOKER_BASE_URL="http://127.0.0.1:$(published_port restful-booker 3001)"
export BW_LOCAL_APP_BASE_URL="http://127.0.0.1:$(published_port local-app 3000)"
export BW_DB_SSH_HOST=127.0.0.1
export BW_DB_SSH_PORT="${ssh_port}"
export BW_DB_SSH_AUTH=key
export BW_DB_SSH_PRIVATE_KEY_PATH="${secrets_dir}/id_ed25519"
export BW_DB_SSH_KNOWN_HOSTS_PATH="${secrets_dir}/known_hosts"

node "${root_dir}/scripts/check-config.ts"

echo "local-stand: running: $*" >&2
run_interruptible "$@"
