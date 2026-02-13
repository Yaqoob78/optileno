"""
Enterprise Cache Service for Optileno SaaS.

Implements Redis-based caching with:
- High availability patterns (Sentinel support)
- Circuit breaker for fault tolerance
- Connection pooling for 5,000+ users
- Multi-tier caching support
- Cache warming strategies
- Real-time cache metrics
"""

import json
import asyncio
import logging
import time
from typing import Any, Optional, Union, Dict, Callable, List
from datetime import datetime, timedelta
from functools import wraps
import redis.asyncio as redis
from redis.asyncio.sentinel import Sentinel

from backend.app.config import settings

logger = logging.getLogger(__name__)


# ==================================================
# Circuit Breaker for Cache Resilience
# ==================================================
class CircuitBreaker:
    """
    Circuit breaker pattern for cache operations.
    Prevents cascading failures when Redis is unavailable.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        half_open_requests: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        
        self.failures = 0
        self.successes = 0
        self.state = "closed"  # closed, open, half_open
        self.last_failure_time: Optional[float] = None
    
    def record_failure(self):
        """Record a failure and potentially open the circuit."""
        self.failures += 1
        self.last_failure_time = time.time()
        
        if self.failures >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"[CACHE] Circuit breaker opened after {self.failures} failures")
    
    def record_success(self):
        """Record a success and potentially close the circuit."""
        self.successes += 1
        
        if self.state == "half_open" and self.successes >= self.half_open_requests:
            self.state = "closed"
            self.failures = 0
            self.successes = 0
            logger.info("[CACHE] Circuit breaker closed after recovery")
    
    def can_execute(self) -> bool:
        """Check if an operation can be executed."""
        if self.state == "closed":
            return True
        
        if self.state == "open":
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = "half_open"
                self.successes = 0
                logger.info("[CACHE] Circuit breaker half-open, testing connection")
                return True
            return False
        
        # half_open - allow limited requests
        return True
    
    def reset(self):
        """Reset the circuit breaker."""
        self.failures = 0
        self.successes = 0
        self.state = "closed"
        self.last_failure_time = None


# ==================================================
# Cache Metrics
# ==================================================
class CacheMetrics:
    """Track cache performance metrics."""
    
    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.errors = 0
        self.total_operations = 0
        self.avg_latency_ms = 0.0
        self._latencies: List[float] = []
        self.is_connected = False
        self.last_health_check: Optional[str] = None
    
    def record_hit(self, latency_ms: float):
        self.hits += 1
        self.total_operations += 1
        self._record_latency(latency_ms)
    
    def record_miss(self, latency_ms: float):
        self.misses += 1
        self.total_operations += 1
        self._record_latency(latency_ms)
    
    def record_error(self):
        self.errors += 1
        self.total_operations += 1
    
    def _record_latency(self, latency_ms: float):
        self._latencies.append(latency_ms)
        # Keep only last 1000 samples
        if len(self._latencies) > 1000:
            self._latencies = self._latencies[-1000:]
        self.avg_latency_ms = sum(self._latencies) / len(self._latencies)
    
    @property
    def hit_rate(self) -> float:
        if self.hits + self.misses == 0:
            return 0.0
        return self.hits / (self.hits + self.misses) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "errors": self.errors,
            "total_operations": self.total_operations,
            "hit_rate": round(self.hit_rate, 2),
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "is_connected": self.is_connected,
            "last_health_check": self.last_health_check,
        }


# ==================================================
# Enterprise Cache Service
# ==================================================
class CacheService:
    """
    Enterprise Redis-based caching service for Optileno.
    
    Features:
    - High availability with Sentinel support
    - Circuit breaker for fault tolerance
    - Connection pooling for 5,000+ users
    - Configurable TTLs via environment
    - Cache warming strategies
    - Real-time metrics
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.circuit_breaker = CircuitBreaker()
        self.metrics = CacheMetrics()
        self._local_cache: Dict[str, Any] = {}  # Fallback in-memory cache
        self._local_cache_expiry: Dict[str, float] = {}
    
    async def initialize(self):
        """Initialize the Redis connection with enterprise configuration."""
        try:
            if settings.REDIS_SENTINEL_ENABLED and settings.REDIS_SENTINEL_HOSTS:
                # Sentinel mode for high availability
                sentinel_hosts = [
                    tuple(host.split(":")) 
                    for host in settings.REDIS_SENTINEL_HOSTS.split(",")
                ]
                sentinel = Sentinel(
                    sentinel_hosts,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                )
                self.redis_client = sentinel.master_for(
                    settings.REDIS_SENTINEL_MASTER,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
                    decode_responses=True,
                )
                logger.info("[CACHE] Connected to Redis via Sentinel")
            else:
                # Standard Redis connection with connection pool
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    health_check_interval=settings.REDIS_HEALTH_CHECK_INTERVAL,
                    socket_keepalive=True,
                    socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    retry_on_timeout=settings.REDIS_RETRY_ON_TIMEOUT,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                )
            
            # Test connection
            await self.redis_client.ping()
            self.metrics.is_connected = True
            self.circuit_breaker.reset()
            logger.info(f"[CHECK] Redis cache initialized (max_connections={settings.REDIS_MAX_CONNECTIONS})")
            
        except Exception as e:
            logger.error(f"[CROSS] Redis cache initialization failed: {e}")
            logger.info("[INFO] Continuing with in-memory fallback cache")
            self.redis_client = None
            self.metrics.is_connected = False
    
    async def close(self):
        """Close the Redis connection."""
        if self.redis_client:
            await self.redis_client.aclose()
            self.metrics.is_connected = False
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform cache health check."""
        health = {
            "status": "unknown",
            "latency_ms": None,
            "error": None,
            "circuit_breaker_state": self.circuit_breaker.state,
        }
        
        if not self.redis_client:
            health["status"] = "degraded"
            health["error"] = "Using in-memory fallback"
            return health
        
        start = time.time()
        try:
            await self.redis_client.ping()
            latency = (time.time() - start) * 1000
            health["status"] = "healthy"
            health["latency_ms"] = round(latency, 2)
            self.metrics.is_connected = True
            self.metrics.last_health_check = datetime.utcnow().isoformat()
        except Exception as e:
            health["status"] = "unhealthy"
            health["error"] = str(e)
            self.metrics.is_connected = False
        
        return health
    
    def _get_local_cache(self, key: str) -> Optional[Any]:
        """Get from in-memory fallback cache."""
        if key in self._local_cache:
            if self._local_cache_expiry.get(key, 0) > time.time():
                return self._local_cache[key]
            else:
                # Expired
                del self._local_cache[key]
                if key in self._local_cache_expiry:
                    del self._local_cache_expiry[key]
        return None
    
    def _set_local_cache(self, key: str, value: Any, ttl: int = 300):
        """Set in-memory fallback cache."""
        self._local_cache[key] = value
        self._local_cache_expiry[key] = time.time() + ttl
        
        # Limit local cache size
        if len(self._local_cache) > 10000:
            # Remove oldest 20%
            sorted_keys = sorted(
                self._local_cache_expiry.keys(),
                key=lambda k: self._local_cache_expiry[k]
            )
            for k in sorted_keys[:2000]:
                self._local_cache.pop(k, None)
                self._local_cache_expiry.pop(k, None)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from cache with circuit breaker protection."""
        start = time.time()
        
        # Check circuit breaker
        if not self.circuit_breaker.can_execute():
            value = self._get_local_cache(key)
            if value is not None:
                self.metrics.record_hit((time.time() - start) * 1000)
            else:
                self.metrics.record_miss((time.time() - start) * 1000)
            return value
        
        if not self.redis_client:
            return self._get_local_cache(key)
        
        try:
            value = await self.redis_client.get(key)
            latency = (time.time() - start) * 1000
            
            if value is not None:
                self.circuit_breaker.record_success()
                self.metrics.record_hit(latency)
                return json.loads(value)
            else:
                self.metrics.record_miss(latency)
                return None
                
        except Exception as e:
            self.circuit_breaker.record_failure()
            self.metrics.record_error()
            logger.warning(f"[CACHE] Get failed for {key}: {e}")
            return self._get_local_cache(key)
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        expire: Union[int, timedelta] = None
    ):
        """Set a value in cache with fallback."""
        ttl = expire if isinstance(expire, int) else (expire.total_seconds() if expire else 300)
        
        # Always update local cache as fallback
        self._set_local_cache(key, value, int(ttl))
        
        if not self.circuit_breaker.can_execute() or not self.redis_client:
            return
        
        try:
            serialized = json.dumps(value, default=str)
            await self.redis_client.set(key, serialized, ex=int(ttl))
            self.circuit_breaker.record_success()
        except Exception as e:
            self.circuit_breaker.record_failure()
            self.metrics.record_error()
            logger.warning(f"[CACHE] Set failed for {key}: {e}")
    
    async def delete(self, key: str):
        """Delete a key from cache."""
        # Delete from local cache
        self._local_cache.pop(key, None)
        self._local_cache_expiry.pop(key, None)
        
        if not self.redis_client or not self.circuit_breaker.can_execute():
            return
        
        try:
            await self.redis_client.delete(key)
            self.circuit_breaker.record_success()
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[CACHE] Delete failed for {key}: {e}")
    
    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache."""
        if not self.redis_client or not self.circuit_breaker.can_execute():
            return key in self._local_cache
        
        try:
            result = await self.redis_client.exists(key) > 0
            self.circuit_breaker.record_success()
            return result
        except Exception:
            self.circuit_breaker.record_failure()
            return key in self._local_cache
    
    async def invalidate_pattern(self, pattern: str):
        """Delete all keys matching a pattern."""
        # Clear matching local cache keys
        keys_to_delete = [k for k in self._local_cache if pattern.replace("*", "") in k]
        for k in keys_to_delete:
            self._local_cache.pop(k, None)
            self._local_cache_expiry.pop(k, None)
        
        if not self.redis_client or not self.circuit_breaker.can_execute():
            return
        
        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                await self.redis_client.delete(*keys)
            self.circuit_breaker.record_success()
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[CACHE] Pattern invalidation failed for {pattern}: {e}")
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """Atomic increment operation."""
        if not self.redis_client or not self.circuit_breaker.can_execute():
            # Fallback to local
            current = self._local_cache.get(key, 0)
            new_val = current + amount
            self._local_cache[key] = new_val
            return new_val
        
        try:
            result = await self.redis_client.incrby(key, amount)
            self.circuit_breaker.record_success()
            return result
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[CACHE] Increment failed for {key}: {e}")
            current = self._local_cache.get(key, 0)
            new_val = current + amount
            self._local_cache[key] = new_val
            return new_val
    
    # ==========================================
    # Domain-Specific Cache Methods (with configurable TTLs)
    # ==========================================
    
    async def get_user_analytics(self, user_id: str) -> Optional[dict]:
        """Get cached user analytics."""
        return await self.get(f"user:analytics:{user_id}")
    
    async def set_user_analytics(self, user_id: str, data: dict, ttl: int = None):
        """Cache user analytics."""
        ttl = ttl or settings.CACHE_TTL_USER_ANALYTICS
        await self.set(f"user:analytics:{user_id}", data, ttl)
    
    async def invalidate_user_analytics(self, user_id: str):
        """Invalidate user analytics cache."""
        await self.delete(f"user:analytics:{user_id}")
    
    async def get_goal_progress(self, user_id: str, goal_id: str) -> Optional[dict]:
        """Get cached goal progress."""
        return await self.get(f"goal:progress:{user_id}:{goal_id}")
    
    async def set_goal_progress(self, user_id: str, goal_id: str, data: dict, ttl: int = None):
        """Cache goal progress."""
        ttl = ttl or settings.CACHE_TTL_GOAL_PROGRESS
        await self.set(f"goal:progress:{user_id}:{goal_id}", data, ttl)
    
    async def get_user_tasks(self, user_id: str) -> Optional[list]:
        """Get cached user tasks."""
        return await self.get(f"user:tasks:{user_id}")
    
    async def set_user_tasks(self, user_id: str, tasks: list, ttl: int = None):
        """Cache user tasks."""
        ttl = ttl or settings.CACHE_TTL_USER_TASKS
        await self.set(f"user:tasks:{user_id}", tasks, ttl)
    
    async def invalidate_user_tasks(self, user_id: str):
        """Invalidate cached user tasks."""
        await self.delete(f"user:tasks:{user_id}")
    
    async def get_ai_context(self, user_id: str) -> Optional[dict]:
        """Get cached AI context."""
        return await self.get(f"ai:context:{user_id}")
    
    async def set_ai_context(self, user_id: str, context: dict, ttl: int = None):
        """Cache AI context."""
        ttl = ttl or settings.CACHE_TTL_AI_CONTEXT
        await self.set(f"ai:context:{user_id}", context, ttl)
    
    async def invalidate_ai_context(self, user_id: str):
        """Invalidate cached AI context."""
        await self.delete(f"ai:context:{user_id}")
    
    async def get_user_session(self, session_id: str) -> Optional[dict]:
        """Get cached user session."""
        return await self.get(f"session:{session_id}")
    
    async def set_user_session(self, session_id: str, data: dict, ttl: int = None):
        """Cache user session."""
        ttl = ttl or settings.CACHE_TTL_SESSION
        await self.set(f"session:{session_id}", data, ttl)
    
    async def invalidate_user_session(self, session_id: str):
        """Invalidate user session."""
        await self.delete(f"session:{session_id}")
    
    async def get_realtime_metrics(self, user_id: str) -> Optional[dict]:
        """Get cached realtime metrics for a user."""
        return await self.get(f"realtime:metrics:{user_id}")
    
    async def set_realtime_metrics(self, user_id: str, metrics: dict, ttl: int = 60):
        """Cache realtime metrics (short TTL for live data)."""
        await self.set(f"realtime:metrics:{user_id}", metrics, ttl)
    
    # ==========================================
    # Rate Limiting Support
    # ==========================================
    
    async def check_rate_limit(
        self, 
        identifier: str, 
        limit: int, 
        window_seconds: int
    ) -> tuple[bool, int]:
        """
        Check and update rate limit.
        
        Returns:
            Tuple of (is_allowed, current_count)
        """
        key = f"ratelimit:{identifier}"
        
        if not self.redis_client or not self.circuit_breaker.can_execute():
            # Fallback to local rate limiting
            current = self._local_cache.get(key, 0)
            if current >= limit:
                return False, current
            self._local_cache[key] = current + 1
            self._local_cache_expiry[key] = time.time() + window_seconds
            return True, current + 1
        
        try:
            pipe = self.redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            results = await pipe.execute()
            
            current_count = results[0]
            self.circuit_breaker.record_success()
            
            return current_count <= limit, current_count
            
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[CACHE] Rate limit check failed: {e}")
            return True, 0  # Allow on error
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get cache metrics."""
        return {
            **self.metrics.to_dict(),
            "circuit_breaker_state": self.circuit_breaker.state,
            "local_cache_size": len(self._local_cache),
            "config": {
                "max_connections": settings.REDIS_MAX_CONNECTIONS,
                "socket_timeout": settings.REDIS_SOCKET_TIMEOUT,
                "sentinel_enabled": settings.REDIS_SENTINEL_ENABLED,
            }
        }


# Global cache instance
cache_service = CacheService()


async def get_cache() -> CacheService:
    """Dependency to get the cache service."""
    return cache_service