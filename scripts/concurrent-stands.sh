#!/usr/bin/env bash
# Proves stand isolation: starts two complete local stands at the same time and runs the
# integration and database suites against each. Both must pass; ports, data, users and cleanup
# queues must not interfere.
#
#   scripts/concurrent-stands.sh
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
logs_dir="$(mktemp -d "${TMPDIR:-/tmp}/bookwright-concurrent.XXXXXX")"
pids=()

cleanup() {
  for pid in "${pids[@]}"; do
    kill -TERM "${pid}" 2>/dev/null || true
  done
  wait || true
}
trap cleanup INT TERM

for run in a b; do
  (
    cd "${root_dir}"
    BW_RUN_SEED="concurrent-${run}" bash scripts/local-stand.sh \
      npx playwright test --project=db --project=integration --project=api --reporter=line \
      >"${logs_dir}/${run}.log" 2>&1
  ) &
  pids+=("$!")
done

status=0
for index in "${!pids[@]}"; do
  if ! wait "${pids[${index}]}"; then
    status=1
  fi
done

for run in a b; do
  echo "=== stand ${run} ==="
  grep -E 'local-stand: (starting|tearing)|passed|failed|flaky' "${logs_dir}/${run}.log" || true
done
rm -rf "${logs_dir}"
exit "${status}"
