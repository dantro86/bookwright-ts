#!/usr/bin/env bash
# Starts an isolated local stand, runs one command against it and always tears it down.
#
#   scripts/local-stand.sh npx playwright test --project=api
#
# Each invocation uses a unique Compose project with dynamic host ports, so concurrent runs on one
# machine do not collide. Teardown removes containers, volumes and networks on success, failure,
# Ctrl+C and SIGTERM.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 64
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${root_dir}/docker/compose.yaml"
project="bookwright-$(date +%s)-$$"

compose() {
  docker compose --file "${compose_file}" --project-name "${project}" "$@"
}

teardown() {
  local status=$?
  trap - EXIT INT TERM
  echo "local-stand: tearing down ${project}" >&2
  compose down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1 ||
    echo "local-stand: teardown of ${project} failed; inspect with 'docker compose ls'" >&2
  exit "${status}"
}
trap teardown EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

published_port() {
  local mapping
  mapping="$(compose port "$1" "$2")"
  echo "${mapping##*:}"
}

echo "local-stand: starting ${project}" >&2
compose up --detach --wait --wait-timeout 180 --quiet-pull --build

export BW_STAND=local
export BW_RESTFUL_BOOKER_BASE_URL="http://127.0.0.1:$(published_port restful-booker 3001)"
export BW_LOCAL_APP_BASE_URL="http://127.0.0.1:$(published_port local-app 3000)"

node "${root_dir}/scripts/check-config.ts"

echo "local-stand: running: $*" >&2
"$@"
