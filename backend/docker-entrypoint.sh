#!/bin/sh
set -eu

echo "Applying database migrations..."
alembic upgrade head

if [ "$#" -eq 0 ]; then
  set -- uvicorn app.main:app --host 0.0.0.0 --port 8000
fi

echo "Starting command: $*"
exec "$@"
