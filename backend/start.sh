#!/bin/bash
set -e

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
