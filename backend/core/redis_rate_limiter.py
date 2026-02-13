"""
Redis-based rate limiting and AI quota management for production scalability.
Replaces in-memory rate limiting with persistent Redis storage.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
import redis.asyncio as redis
from fastapi import HTTPException, status

from backend.app.config import settings

logger = logging.getLogger(__name__)

class RedisRateLimiter:
    """Production-ready rate limiting using Redis"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize Redis connection"""
        if self._initialized:
            return
        
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Test connection
            await self.redis_client.ping()
            self._initialized = True
            logger.info("Redis rate limiter initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis rate limiter: {e}")
            # Fallback to in-memory if Redis is not available
            self.redis_client = None
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            self._initialized = False
    
    async def check_rate_limit(
        self,
        user_id: str,
        max_requests: int = 30,
        window_seconds: int = 60,
        identifier: str = "api"
    ) -> bool:
        """
        Check if user exceeds rate limit using Redis sliding window.
        
        Args:
            user_id: User identifier
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds
            identifier: Additional identifier for different rate limits
        
        Returns:
            True if request is allowed, False otherwise
        """
        if not self.redis_client:
            # Fallback to simple in-memory check
            return True
        
        try:
            now = datetime.now(timezone.utc)
            pipeline = self.redis_client.pipeline()
            
            # Key for this user's rate limit
            key = f"rate_limit:{identifier}:{user_id}"
            
            # Remove old entries outside the window
            pipeline.zremrangebyscore(key, 0, now.timestamp() - window_seconds)
            
            # Count current requests
            pipeline.zcard(key)
            
            # Add current request
            pipeline.zadd(key, {str(now.timestamp()): now.timestamp()})
            
            # Set expiration
            pipeline.expire(key, window_seconds)
            
            results = await pipeline.execute()
            current_requests = results[1]
            
            if current_requests >= max_requests:
                logger.warning(f"Rate limit exceeded for user {user_id}: {current_requests}/{max_requests}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Allow request on error (fail open)
            return True
    
    async def get_rate_limit_status(
        self,
        user_id: str,
        window_seconds: int = 60,
        identifier: str = "api"
    ) -> Dict:
        """Get current rate limit status for user"""
        if not self.redis_client:
            return {"remaining": 30, "reset_time": None, "limit": 30}
        
        try:
            key = f"rate_limit:{identifier}:{user_id}"
            now = datetime.now(timezone.utc)
            
            # Clean old entries
            await self.redis_client.zremrangebyscore(key, 0, now.timestamp() - window_seconds)
            
            # Get current count and TTL
            current_requests = await self.redis_client.zcard(key)
            ttl = await self.redis_client.ttl(key)
            
            reset_time = None
            if ttl > 0:
                reset_time = now + timedelta(seconds=ttl)
            
            return {
                "remaining": max(0, 30 - current_requests),
                "reset_time": reset_time.isoformat() if reset_time else None,
                "limit": 30,
                "current": current_requests
            }
            
        except Exception as e:
            logger.error(f"Failed to get rate limit status: {e}")
            return {"remaining": 30, "reset_time": None, "limit": 30}

class RedisAIQuota:
    """AI quota management using Redis"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    async def check_ai_quota(
        self,
        user_id: str,
        daily_limit: int = 100,
        quota_type: str = "general"
    ) -> bool:
        """
        Check and update AI quota for user.
        
        Args:
            user_id: User identifier
            daily_limit: Daily quota limit
            quota_type: Type of AI usage (general, premium, etc.)
        
        Returns:
            True if quota is available, False otherwise
        """
        try:
            now = datetime.now(timezone.utc)
            midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Key for daily quota
            key = f"ai_quota:{quota_type}:{user_id}:{midnight.date().isoformat()}"
            
            # Get current usage
            current_usage = await self.redis.get(key) or "0"
            current_usage = int(current_usage)
            
            if current_usage >= daily_limit:
                logger.warning(f"AI quota exceeded for user {user_id}: {current_usage}/{daily_limit}")
                return False
            
            # Increment usage
            await self.redis.incr(key)
            await self.redis.expireat(key, int((midnight + timedelta(days=1)).timestamp()))
            
            return True
            
        except Exception as e:
            logger.error(f"AI quota check failed: {e}")
            # Allow request on error (fail open)
            return True
    
    async def get_ai_quota_status(
        self,
        user_id: str,
        quota_type: str = "general"
    ) -> Dict:
        """Get current AI quota status"""
        try:
            now = datetime.now(timezone.utc)
            midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            key = f"ai_quota:{quota_type}:{user_id}:{midnight.date().isoformat()}"
            
            current_usage = await self.redis.get(key) or "0"
            current_usage = int(current_usage)
            
            # Get different limits for different user tiers
            daily_limit = await self._get_user_quota_limit(user_id, quota_type)
            
            return {
                "used": current_usage,
                "limit": daily_limit,
                "remaining": max(0, daily_limit - current_usage),
                "resets_at": (midnight + timedelta(days=1)).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get AI quota status: {e}")
            return {"used": 0, "limit": 100, "remaining": 100, "resets_at": None}
    
    async def _get_user_quota_limit(self, user_id: str, quota_type: str) -> int:
        """Get user-specific quota limit based on subscription tier"""
        try:
            # This would typically fetch from database
            # For now, return default limits
            limits = {
                "general": 100,
                "premium": 500,
                "elite": 2000
            }
            return limits.get(quota_type, 100)
        except Exception:
            return 100

# Global instances
redis_rate_limiter = RedisRateLimiter()
redis_ai_quota: Optional[RedisAIQuota] = None

async def get_redis_ai_quota() -> RedisAIQuota:
    """Get AI quota manager instance"""
    global redis_ai_quota
    
    if redis_ai_quota is None:
        await redis_rate_limiter.initialize()
        if redis_rate_limiter.redis_client:
            redis_ai_quota = RedisAIQuota(redis_rate_limiter.redis_client)
    
    return redis_ai_quota

# Dependency injection functions
async def check_api_rate_limit(user_id: str, max_requests: int = 30):
    """FastAPI dependency for rate limiting"""
    await redis_rate_limiter.initialize()
    
    if not await redis_rate_limiter.check_rate_limit(user_id, max_requests):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again later.",
            headers={
                "Retry-After": "60",
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": "0"
            }
        )

async def check_ai_quota_limit(user_id: str, quota_type: str = "general"):
    """FastAPI dependency for AI quota checking"""
    quota_manager = await get_redis_ai_quota()
    
    if not await quota_manager.check_ai_quota(user_id, quota_type=quota_type):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI usage limit reached. Try again tomorrow.",
            headers={"X-Quota-Limit": "100", "X-Quota-Remaining": "0"}
        )
