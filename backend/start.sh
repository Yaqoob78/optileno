#!/bin/bash
# backend/start.sh

# Exit on error
set -e

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Calculate workers (if not set by env)
if [ -z "$WORKERS" ]; then
  CORES=$(nproc)
  WORKERS=$((CORES * 2 + 1))
  # Cap at 8 workers to avoid excessive memory usage
  if [ "$WORKERS" -gt 8 ]; then
    WORKERS=8
  fi
# Default PORT if not set
if [ -z "$PORT" ]; then
  PORT=8000
fi

echo "Starting server with $WORKERS workers..."
exec gunicorn backend.app.main:app \
    --workers $WORKERS \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:$PORT \
    --timeout 120 \
    --keep-alive 5 \
    --log-level info
