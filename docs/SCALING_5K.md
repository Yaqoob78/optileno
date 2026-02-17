# Optileno 5K+ Scaling Runbook

This runbook documents the runtime controls now wired in code for handling ~5,000 concurrent users and how to scale beyond that.

## 1) What is now implemented

- Distributed HTTP rate limiting (Redis-backed) with process-local fallback.
- Atomic Redis limiter behavior so rejected requests do not consume extra quota.
- JWT/IP-aware limiter identifiers in middleware.
- Production uvicorn worker auto-sizing in `backend/start.sh`.
- Tuned DB engine pool settings are now actually applied:
  - `pool_size`, `max_overflow`, `pool_timeout`, `pool_recycle`, `pool_use_lifo`
  - Postgres `statement_timeout` and asyncpg `command_timeout`
- WebSocket hard max connection enforcement now counts all sockets (authenticated + unauthenticated).
- WebSocket queued fan-out processing with queue-pressure metrics (dropped queued messages, rejected connections).
- Redis rate limiter warm-init on startup and clean shutdown on app stop.
- AI quota checks fail-open when Redis is unavailable (prevents avoidable request outages).

## 2) Recommended env values (starting point for 5k target)

Use these as a baseline and tune with staging load tests:

```env
# Worker/process model
ENVIRONMENT=production
WORKERS_PER_CORE=2
MAX_WORKERS=8
WEB_CONCURRENCY=8

# Uvicorn runtime
UVICORN_BACKLOG=4096
UVICORN_TIMEOUT_KEEP_ALIVE=10
UVICORN_LIMIT_CONCURRENCY=2500
UVICORN_LIMIT_MAX_REQUESTS=20000

# DB pool
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=300
DB_STATEMENT_TIMEOUT=30000

# Redis
REDIS_URL=redis://redis:6379/0
REDIS_MAX_CONNECTIONS=500
REDIS_SOCKET_TIMEOUT=5
REDIS_SOCKET_CONNECT_TIMEOUT=5
REDIS_HEALTH_CHECK_INTERVAL=30
REDIS_RETRY_ON_TIMEOUT=true

# WebSocket
WEBSOCKET_MAX_CONNECTIONS=10000
WEBSOCKET_MESSAGE_QUEUE_SIZE=5000
WEBSOCKET_QUEUE_THRESHOLD_CONNECTIONS=1000
WEBSOCKET_QUEUE_BATCH_SIZE=200
WEBSOCKET_QUEUE_PROCESS_INTERVAL_MS=25
```

## 3) Beyond 5,000 concurrent users

- Run multiple backend instances behind a load balancer.
- Keep Redis external/shared so rate limits stay consistent.
- Keep Postgres managed/external and scale read replicas as needed.
- Keep sticky sessions enabled for websocket-heavy workloads, or ensure full pub/sub fan-out path.

## 4) Capacity validation checklist

1. Run staged load tests at 500, 1k, 2k, 5k concurrent users.
2. Track:
   - p50/p95/p99 latency
   - 429 and 5xx rates
   - DB pool checkout saturation
   - Redis ops/sec + latency
   - websocket queue depth
   - websocket dropped queue messages
   - websocket rejected connections
3. Confirm steady-state for at least 30 minutes at 5k target.
4. Repeat with a spike profile (2x burst for 2-5 minutes).

## 5) Load test command

```bash
k6 run -e BASE_URL=https://your-domain.com scripts/loadtest_k6.js
```
