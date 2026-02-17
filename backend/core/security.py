"""
Security utilities: authentication, Redis-based rate limiting, AI quota protection.
"""

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db
from backend.db.models import User
from sqlalchemy import select
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Dict
import logging

from backend.app.config import settings
from backend.services.user_service import user_service
from backend.core.redis_rate_limiter import check_api_rate_limit, check_ai_quota_limit
from backend.utils.owner import is_owner_email

logger = logging.getLogger(__name__)


# =========================
# Auth
# =========================
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate JWT from HttpOnly cookie and return current user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = request.cookies.get("access_token")
    if not token:
        # Optional: check Authorization header as fallback for dev
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id = payload.get("user_id")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    # Ensure configured owner account always has full privileges, even on old sessions.
    if is_owner_email(getattr(user, "email", None)):
        needs_owner_sync = (
            (getattr(user, "role", "") or "").strip().lower() != "admin"
            or (getattr(user, "tier", "") or "").strip().lower() != "ultra"
            or (getattr(user, "plan_type", "") or "").strip().upper() != "ULTRA"
            or not bool(getattr(user, "is_superuser", False))
        )
        if needs_owner_sync:
            user.role = "admin"
            user.tier = "ultra"
            user.plan_type = "ULTRA"
            user.is_superuser = True
            await db.commit()
            await db.refresh(user)

    return user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


# =========================
# Rate Limiting (Redis-based)
# =========================
async def rate_limited_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    max_requests: int = 30
) -> User:
    """Get current user with rate limiting"""
    user = await get_current_user(request, db)
    await check_api_rate_limit(str(user.id), max_requests)
    return user

async def ai_rate_limited_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    quota_type: str = "general"
) -> User:
    """Get current user with AI quota checking"""
    user = await get_current_user(request, db)
    await check_ai_quota_limit(str(user.id), quota_type)
    return user

# =========================
# Legacy Functions (Deprecated)
# =========================
def check_rate_limit(
    user_id: str,
    max_requests: int = 30,
    window_seconds: int = 60,
):
    """Deprecated: Use Redis-based rate limiting instead"""
    logger.warning("Using deprecated in-memory rate limiting. Please migrate to Redis-based.")
    # This function is kept for backward compatibility but should not be used
    pass

def check_ai_quota(
    user_id: str,
    daily_limit: int = 100,
):
    """Deprecated: Use Redis-based AI quota instead"""
    logger.warning("Using deprecated in-memory AI quota. Please migrate to Redis-based.")
    # This function is kept for backward compatibility but should not be used
    pass
