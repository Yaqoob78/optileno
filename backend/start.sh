#!/bin/bash
set -e

# Run migrations
# We need to be in the directory containing alembic.ini or point to it
echo "Running database migrations..."
cd /app/backend
alembic upgrade head
cd /app

# Start application
echo "Starting application with Uvicorn..."
exec python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
