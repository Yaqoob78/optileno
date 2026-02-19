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

PAYMENT_GATED_STATUSES = {"pending_payment", "payment_failed"}
PAYMENT_GATE_ALLOWED_PREFIXES = (
    "/api/v1/payments",
    "/api/v1/subscriptions",
    "/payments",
    "/subscriptions",
)
PAYMENT_GATE_ALLOWED_ROUTES = {
    ("GET", "/api/v1/users/me"),
    ("GET", "/api/v1/users/me/subscription"),
    ("POST", "/api/v1/auth/logout"),
    ("POST", "/api/v1/auth/refresh"),
    ("GET", "/api/v1/auth/validate"),
    ("GET", "/api/v1/auth/me"),
    ("POST", "/auth/logout"),
    ("POST", "/auth/refresh"),
    ("GET", "/auth/validate"),
    ("GET", "/auth/me"),
    ("GET", "/users/me"),
    ("GET", "/users/me/subscription"),
}


def _is_payment_gate_exempt(request: Request) -> bool:
    path = (request.url.path or "").rstrip("/") or "/"
    method = (request.method or "GET").upper()

    if any(path.startswith(prefix) for prefix in PAYMENT_GATE_ALLOWED_PREFIXES):
        return True

    return (method, path) in PAYMENT_GATE_ALLOWED_ROUTES


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
            try:
                await db.commit()
                await db.refresh(user)
            except Exception as exc:
                logger.warning("Owner privilege sync commit failed for user %s: %s", getattr(user, "id", "unknown"), exc)
                await db.rollback()
                # Keep in-memory privileges for the current request even if persistence fails.
                user.role = "admin"
                user.tier = "ultra"
                user.plan_type = "ULTRA"
                user.is_superuser = True

    # Enforce payment completion server-side to prevent API-level bypasses.
    subscription_status = (getattr(user, "subscription_status", "") or "").strip().lower()
    if (
        not is_owner_email(getattr(user, "email", None))
        and subscription_status in PAYMENT_GATED_STATUSES
        and not _is_payment_gate_exempt(request)
    ):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Complete subscription payment to access this resource.",
        )

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
