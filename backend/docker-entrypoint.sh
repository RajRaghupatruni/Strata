#!/bin/sh
set -eu

echo "Applying database migrations..."
alembic upgrade head

# With no Docker command supplied this is the normal service path. Keep demo
# seeding opt-in and out of one-off command execution (docker compose run ...).
if [ "$#" -eq 0 ]; then
  set -- uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
  if [ "${SEED_DEMO_ON_START:-false}" = "true" ]; then
    echo "Seeding deterministic demo data..."
    python -m app.seed_demo --allow-nonlocal
  fi
fi

echo "Starting command: $*"
exec "$@"
