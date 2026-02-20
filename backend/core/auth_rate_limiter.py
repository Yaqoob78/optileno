"""
Auth-specific rate limiting for login/register endpoints.

Implements per-IP and per-identifier throttling with Redis as primary storage
and in-memory fallback when Redis is unavailable.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from collections import defaultdict, deque
from typing import Deque
from uuid import uuid4

from fastapi import HTTPException, Request, status

from backend.app.config import settings
from backend.core.redis_rate_limiter import redis_rate_limiter

logger = logging.getLogger(__name__)


class AuthRateLimiter:
    def __init__(self) -> None:
        self._local_buckets: dict[str, Deque[float]] = defaultdict(deque)
        self._local_lock = asyncio.Lock()

    @staticmethod
    def _extract_client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            first = forwarded_for.split(",")[0].strip()
            if first:
                return first

        x_real_ip = request.headers.get("x-real-ip", "").strip()
        if x_real_ip:
            return x_real_ip

        return request.client.host if request.client else "unknown"

    @staticmethod
    def _normalize_identifier(identifier: str) -> str:
        return (identifier or "").strip().lower()

    @staticmethod
    def _hash_identifier(identifier: str) -> str:
        return hashlib.sha256(identifier.encode("utf-8")).hexdigest()

    @staticmethod
    def _action_limits(action: str) -> tuple[int, int]:
        action_name = (action or "").strip().lower()
        if action_name == "register":
            return (
                settings.AUTH_RATE_LIMIT_REGISTER_IP_MAX_ATTEMPTS,
                settings.AUTH_RATE_LIMIT_REGISTER_IDENTIFIER_MAX_ATTEMPTS,
            )
        return (
            settings.AUTH_RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS,
            settings.AUTH_RATE_LIMIT_LOGIN_IDENTIFIER_MAX_ATTEMPTS,
        )

    @staticmethod
    def _window_seconds() -> int:
        return max(1, int(settings.AUTH_RATE_LIMIT_WINDOW_SECONDS))

    async def _check_redis_bucket(self, key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
        if not redis_rate_limiter.redis_client:
            return True, 0

        now = time.time()
        member = f"{now}:{uuid4().hex}"

        result = await redis_rate_limiter.redis_client.eval(
            """
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local max_attempts = tonumber(ARGV[3])
            local member = ARGV[4]

            redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
            local current = redis.call('ZCARD', key)

            if current >= max_attempts then
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                local retry_after = window
                if oldest[2] then
                    retry_after = math.ceil(window - (now - tonumber(oldest[2])))
                    if retry_after < 1 then
                        retry_after = 1
                    end
                end
                redis.call('EXPIRE', key, window)
                return {0, retry_after}
            end

            redis.call('ZADD', key, now, member)
            redis.call('EXPIRE', key, window)
            return {1, 0}
            """,
            1,
            key,
            str(now),
            str(window_seconds),
            str(max_attempts),
            member,
        )

        is_allowed = bool(int(result[0]))
        retry_after = int(result[1])
        return is_allowed, max(0, retry_after)

    async def _check_local_bucket(self, key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds

        async with self._local_lock:
            bucket = self._local_buckets[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= max_attempts:
                retry_after = max(1, int(window_seconds - (now - bucket[0])) + 1)
                return False, retry_after

            bucket.append(now)
            return True, 0

    async def _check_bucket(self, key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
        if max_attempts <= 0:
            return True, 0

        try:
            await redis_rate_limiter.initialize()
            if redis_rate_limiter.redis_client:
                return await self._check_redis_bucket(key, max_attempts=max_attempts, window_seconds=window_seconds)
        except Exception as exc:
            logger.warning("Auth Redis rate limiter unavailable, using local fallback: %s", exc)

        return await self._check_local_bucket(key, max_attempts=max_attempts, window_seconds=window_seconds)

    async def enforce(self, request: Request, action: str, identifier: str) -> None:
        if not settings.AUTH_RATE_LIMIT_ENABLED:
            return

        window_seconds = self._window_seconds()
        ip_limit, identifier_limit = self._action_limits(action)

        client_ip = self._extract_client_ip(request)
        normalized_identifier = self._normalize_identifier(identifier)

        ip_key = f"auth_limit:{action}:ip:{client_ip}"
        identifier_key = f"auth_limit:{action}:id:{self._hash_identifier(normalized_identifier)}"

        (ip_allowed, ip_retry_after), (id_allowed, id_retry_after) = await asyncio.gather(
            self._check_bucket(ip_key, max_attempts=ip_limit, window_seconds=window_seconds),
            self._check_bucket(identifier_key, max_attempts=identifier_limit, window_seconds=window_seconds),
        )

        if ip_allowed and id_allowed:
            return

        retry_after = max(ip_retry_after, id_retry_after, 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


auth_rate_limiter = AuthRateLimiter()
