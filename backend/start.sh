#!/bin/bash
set -e

# Normalize DATABASE_URL for common Railway misconfigurations.
# People often paste values with wrapping quotes or unresolved templates.
if [ -n "${DATABASE_URL:-}" ]; then
  DB_URL="${DATABASE_URL}"

  FIRST_CHAR="${DB_URL:0:1}"
  LAST_CHAR="${DB_URL: -1}"
  if [[ "${FIRST_CHAR}" == "\"" && "${LAST_CHAR}" == "\"" ]] || [[ "${FIRST_CHAR}" == "'" && "${LAST_CHAR}" == "'" ]]; then
    DB_URL="${DB_URL:1:${#DB_URL}-2}"
  fi

  if [[ "${DB_URL}" == \$\{* ]] || [[ "${DB_URL}" == \$\{\{* ]]; then
    echo "DATABASE_URL looks unresolved: ${DB_URL}"
    echo "Set DATABASE_URL to the real connection string in Railway Variables."
    exit 1
  fi

  export DATABASE_URL="${DB_URL}"
fi

# Run migrations
# We need to be in the directory containing alembic.ini or point to it
echo "Running database migrations..."
cd /app/backend
alembic upgrade head
cd /app

# Default to port 8000 if PORT is not set.
# Guard against accidental literal values like "$PORT" from host env config.
PORT_VALUE="${PORT:-8000}"
if ! [[ "$PORT_VALUE" =~ ^[0-9]+$ ]]; then
  echo "Invalid PORT value '$PORT_VALUE'. Falling back to 8000."
  PORT_VALUE="8000"
fi

echo "Starting application with Uvicorn on port $PORT_VALUE..."
exec python -m uvicorn backend.app.main:app --host 0.0.0.0 --port "$PORT_VALUE"
