"""
Security enhancements for Concierge AI backend.

Implements additional security measures including:
- Enhanced authentication
- Rate limiting
- Input validation
- Session management
- Audit logging
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import hashlib
import secrets
import logging
from fastapi import Request, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.app.config import settings
from backend.db.database import get_db
from backend.db.models import User, RefreshToken
from backend.core.security import verify_password, get_password_hash
from backend.core.cache import cache_service

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SecurityEnhancementService:
    """
    Enhanced security service for the Concierge AI backend.
    
    Provides advanced security features:
    - Multi-factor authentication
    - Enhanced session management
    - Rate limiting
    - Audit logging
    - Secure token handling
    """
    
    def __init__(self):
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
    
    async def generate_secure_token(self, length: int = 32) -> str:
        """Generate a cryptographically secure random token."""
        return secrets.token_urlsafe(length)
    
    async def hash_token(self, token: str) -> str:
        """Hash a token using SHA-256 for storage."""
        return hashlib.sha256(token.encode()).hexdigest()
    
    async def create_refresh_token(self, user_id: int) -> Dict[str, Any]:
        """Create a secure refresh token for the user."""
        token_value = await self.generate_secure_token()
        token_hash = await self.hash_token(token_value)
        
        # Set expiration (typically 30 days)
        expires_at = datetime.utcnow() + timedelta(days=30)
        
        # Store in database
        async for db in get_db():
            refresh_token = RefreshToken(
                token=token_hash,
                user_id=user_id,
                expires_at=expires_at
            )
            db.add(refresh_token)
            await db.commit()
            await db.refresh(refresh_token)
        
        return {
            "token": token_value,  # Return the plain token to the user
            "expires_at": expires_at.isoformat(),
            "token_id": refresh_token.id
        }
    
    async def validate_refresh_token(self, token: str, user_id: int) -> bool:
        """Validate a refresh token."""
        token_hash = await self.hash_token(token)
        
        async for db in get_db():
            refresh_token = db.query(RefreshToken).filter(
                RefreshToken.token == token_hash,
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at > datetime.utcnow(),
                RefreshToken.is_revoked == False
            ).first()
            
            if refresh_token:
                # Mark as used (for one-time use tokens) or update last used
                refresh_token.last_used_at = datetime.utcnow()
                await db.commit()
                return True
        
        return False
    
    async def revoke_refresh_token(self, token: str, user_id: int) -> bool:
        """Revoke a refresh token."""
        token_hash = await self.hash_token(token)
        
        async for db in get_db():
            refresh_token = db.query(RefreshToken).filter(
                RefreshToken.token == token_hash,
                RefreshToken.user_id == user_id
            ).first()
            
            if refresh_token:
                refresh_token.is_revoked = True
                await db.commit()
                return True
        
        return False
    
    async def enforce_rate_limit(self, identifier: str, limit: int = 100, window: int = 3600) -> bool:
        """
        Enforce rate limiting using cache.
        
        Args:
            identifier: Unique identifier for the rate limiter (IP, user_id, etc.)
            limit: Number of requests allowed
            window: Time window in seconds
        
        Returns:
            True if request is allowed, False if rate limited
        """
        cache_key = f"rate_limit:{identifier}"
        
        # Get current count and expiry from cache
        cached_data = await cache_service.get(cache_key)
        
        if cached_data:
            count, expiry = cached_data
            current_time = datetime.utcnow().timestamp()
            
            if current_time > expiry:
                # Reset counter after window expires
                count = 1
                expiry = current_time + window
            else:
                # Increment counter
                count += 1
        else:
            # First request in this window
            count = 1
            expiry = datetime.utcnow().timestamp() + window
        
        # Store updated count and expiry
        await cache_service.set(cache_key, [count, expiry], window)
        
        # Check if limit exceeded
        if count > limit:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return False
        
        return True
    
    async def log_security_event(self, user_id: Optional[int], event_type: str, details: Dict[str, Any]):
        """Log security-related events for audit purposes."""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "event_type": event_type,
            "details": details,
            "ip_address": details.get("ip_address", "unknown"),
            "user_agent": details.get("user_agent", "unknown")
        }
        
        # Store in cache for quick access to recent events
        cache_key = f"security:events:user:{user_id}" if user_id else "security:events:anonymous"
        recent_events = await cache_service.get(cache_key) or []
        
        # Keep only last 100 events
        recent_events = (recent_events + [event])[-100:]
        await cache_service.set(cache_key, recent_events, 86400)  # 24 hours
        
        logger.info(f"Security event: {event_type} for user {user_id}")
    
    async def check_brute_force_attempts(self, identifier: str, max_attempts: int = 5, window_minutes: int = 15) -> bool:
        """
        Check if there have been too many failed attempts from an identifier.
        
        Args:
            identifier: IP address or username
            max_attempts: Maximum allowed attempts
            window_minutes: Time window to check in minutes
        
        Returns:
            True if allowed, False if blocked
        """
        cache_key = f"bruteforce:{identifier}"
        
        attempts_data = await cache_service.get(cache_key)
        
        if not attempts_data:
            # No previous attempts, allow
            await cache_service.set(cache_key, {"count": 1, "timestamp": datetime.utcnow().isoformat()}, window_minutes * 60)
            return True
        
        # Check if window has expired
        attempt_time = datetime.fromisoformat(attempts_data["timestamp"])
        current_time = datetime.utcnow()
        time_diff = (current_time - attempt_time).seconds / 60  # in minutes
        
        if time_diff > window_minutes:
            # Reset counter after window expires
            await cache_service.set(cache_key, {"count": 1, "timestamp": datetime.utcnow().isoformat()}, window_minutes * 60)
            return True
        
        # Increment count
        attempts_data["count"] += 1
        await cache_service.set(cache_key, attempts_data, int((window_minutes - time_diff) * 60))
        
        if attempts_data["count"] > max_attempts:
            logger.warning(f"Brute force attempt detected from {identifier}")
            return False
        
        return True
    
    async def increment_failed_login_attempt(self, identifier: str, window_minutes: int = 15):
        """Increment failed login attempt counter."""
        cache_key = f"failed_login:{identifier}"
        
        attempts_data = await cache_service.get(cache_key)
        
        if not attempts_data:
            await cache_service.set(cache_key, {"count": 1, "timestamp": datetime.utcnow().isoformat()}, window_minutes * 60)
        else:
            attempt_time = datetime.fromisoformat(attempts_data["timestamp"])
            current_time = datetime.utcnow()
            time_diff = (current_time - attempt_time).seconds / 60  # in minutes
            
            if time_diff > window_minutes:
                # Reset after window expires
                await cache_service.set(cache_key, {"count": 1, "timestamp": datetime.utcnow().isoformat()}, window_minutes * 60)
            else:
                # Increment count
                attempts_data["count"] += 1
                await cache_service.set(cache_key, attempts_data, int((window_minutes - time_diff) * 60))
    
    async def get_user_security_profile(self, user_id: int) -> Dict[str, Any]:
        """Get security profile for a user."""
        async for db in get_db():
            user = db.query(User).filter(User.id == user_id).first()
            
            if not user:
                return {}
            
            # Get recent security events
            security_events = await cache_service.get(f"security:events:user:{user_id}") or []
            
            # Get active sessions (simplified - in a real app you'd track sessions)
            active_sessions = await cache_service.get(f"user:sessions:{user_id}") or []
            
            return {
                "user_id": user.id,
                "email": user.email,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "role": user.role,
                "tier": user.tier,
                "recent_security_events": security_events[-10:],  # Last 10 events
                "active_sessions": len(active_sessions),
                "password_last_changed": getattr(user, 'password_last_changed', None),
                "two_factor_enabled": getattr(user, 'two_factor_enabled', False),
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            }
    
    async def enable_two_factor_auth(self, user_id: int, secret: str) -> bool:
        """Enable two-factor authentication for a user."""
        # In a real implementation, you'd store the TFA secret securely
        # For now, we'll just simulate the process
        cache_key = f"user:tfa:{user_id}"
        await cache_service.set(cache_key, {"enabled": True, "secret": secret}, 86400 * 30)  # 30 days
        
        # Log the security event
        await self.log_security_event(
            user_id, 
            "TWO_FACTOR_ENABLED", 
            {"method": "totp", "timestamp": datetime.utcnow().isoformat()}
        )
        
        return True
    
    async def verify_two_factor_code(self, user_id: int, code: str) -> bool:
        """Verify a two-factor authentication code."""
        # In a real implementation, you'd validate the TOTP code
        # For simulation, we'll just check if TFA is enabled
        cache_key = f"user:tfa:{user_id}"
        tfa_data = await cache_service.get(cache_key)
        
        if not tfa_data or not tfa_data.get("enabled"):
            return True  # Skip verification if TFA not enabled
        
        # In a real implementation, you'd validate the code against the secret
        # For now, we'll just return True to simulate successful verification
        return True


# Global security enhancement service instance
security_enhancement_service = SecurityEnhancementService()