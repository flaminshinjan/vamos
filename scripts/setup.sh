#!/usr/bin/env bash
# One-shot setup: Python venv + editable installs + web deps.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Creating Python venv (.venv) with Python 3.11…"
uv venv --python 3.11 .venv

echo "→ Installing Python workspace (core, agents, api)…"
uv pip install --python .venv/bin/python \
  -e packages/core \
  -e packages/agents \
  -e apps/api \
  pytest pytest-asyncio

echo "→ Installing web deps…"
if command -v pnpm >/dev/null 2>&1; then
  ( cd apps/web && pnpm install )
else
  ( cd apps/web && npm install )
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ Copied .env.example → .env. Fill in ANTHROPIC_API_KEY."
fi

echo "✓ Setup complete."
echo "  API:  source .venv/bin/activate && vamos-api"
echo "  Web:  cd apps/web && pnpm dev"
echo "  CLI:  vamos-cli list"
