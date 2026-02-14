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

# Accept alternative environment variable names if DATABASE_URL is absent.
if [ -z "${DATABASE_URL:-}" ]; then
  for ALT_DB_VAR in DATABASE_PRIVATE_URL DATABASE_PUBLIC_URL POSTGRES_URL POSTGRESQL_URL; do
    ALT_VALUE="${!ALT_DB_VAR:-}"
    if [ -n "${ALT_VALUE}" ]; then
      export DATABASE_URL="${ALT_VALUE}"
      echo "DATABASE_URL was missing; using ${ALT_DB_VAR}."
      break
    fi
  done
fi

# Fallback: construct DATABASE_URL from Railway Postgres PG* variables.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGHOST:-}" ] && [ -n "${PGUSER:-}" ] && [ -n "${PGPASSWORD:-}" ] && [ -n "${PGDATABASE:-}" ]; then
  ENCODED_USER=$(python -c "import os,urllib.parse; print(urllib.parse.quote(os.environ.get('PGUSER',''), safe=''))")
  ENCODED_PASS=$(python -c "import os,urllib.parse; print(urllib.parse.quote(os.environ.get('PGPASSWORD',''), safe=''))")
  PG_PORT_VALUE="${PGPORT:-5432}"
  export DATABASE_URL="postgresql+asyncpg://${ENCODED_USER}:${ENCODED_PASS}@${PGHOST}:${PG_PORT_VALUE}/${PGDATABASE}"
  echo "DATABASE_URL was missing; built from PG* environment variables."
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. PostgreSQL is required in production."
  exit 1
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
