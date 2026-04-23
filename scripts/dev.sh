#!/usr/bin/env bash
# Run API + web side by side for local dev.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a; source .env; set +a
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "⚠  ANTHROPIC_API_KEY is not set — /advisor/brief will fail."
fi

trap 'kill 0 2>/dev/null' EXIT INT TERM

# API
(
  VAMOS_DATA_DIR="${VAMOS_DATA_DIR:-./data}" \
  .venv/bin/python -m vamos_api.main
) &

# Web
(
  cd apps/web && NEXT_PUBLIC_API_URL="http://localhost:${API_PORT:-8247}" pnpm dev
) &

wait
