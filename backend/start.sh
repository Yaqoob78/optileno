#!/bin/bash
set -e

# Run migrations
# We need to be in the directory containing alembic.ini or point to it
echo "Running database migrations..."
cd /app/backend
alembic upgrade head
cd /app

# Default to port 8000 if PORT is not set
: "${PORT:=8000}"

echo "Starting application with Uvicorn on port $PORT..."
exec python -m uvicorn backend.app.main:app --host 0.0.0.0 --port "$PORT"
