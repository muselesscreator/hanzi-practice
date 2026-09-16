#!/usr/bin/env bash
# All-in-one deploy: rebuild the course data, then stage dist/ for the public
# static server (hanzi-practice.service, router port 8081). The service serves
# dist/ directly, so no restart is needed once staging completes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
STAGE="$ROOT/../.hosting/stage-hanzi.sh"

cd "$ROOT"
npm run build

if [ ! -f "$STAGE" ]; then
  echo "error: stage script not found at $STAGE" >&2
  exit 1
fi
bash "$STAGE"

echo "deploy complete: dist/ staged and live via hanzi-practice.service (port 8081)"
