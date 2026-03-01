"""
Security utilities: authentication, Redis-based rate limiting, AI quota protection.
"""

import asyncio
import logging

from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models import User

from backend.app.config import settings
from backend.core.redis_rate_limiter import check_api_rate_limit, check_ai_quota_limit
from backend.utils.owner import is_owner_email
from backend.utils.access_grants import get_access_grant

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

ACCESS_GRANT_EXPIRED_DETAIL = "Access grant expired. Contact support to renew access."


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

    # A tiny retry helps absorb short-lived pool spikes under bursty traffic.
    for attempt in range(2):
        try:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            break
        except SQLAlchemyTimeoutError as exc:
            if attempt == 0:
                await asyncio.sleep(0.05)
                continue
            logger.error("Database pool exhausted while resolving current user %s: %s", user_id, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database is temporarily busy. Please retry.",
            ) from exc

    if not user or not user.is_active:
        try:
            if db.in_transaction():
                await db.rollback()
        except Exception:
            pass
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

    user_email = str(getattr(user, "email", "") or "").strip().lower()
    grant = await get_access_grant(user_email, db) if user_email else None
    if grant and not grant.get("is_currently_active"):
        user.subscription_status = "canceled"
        user.trial_ends_at = None
        try:
            await db.commit()
        except Exception as exc:
            logger.warning("Expired access grant sync failed for user %s: %s", getattr(user, "id", "unknown"), exc)
            await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCESS_GRANT_EXPIRED_DETAIL,
        )

    # Release any open auth transaction immediately so long-running handlers don't
    # pin a pooled connection for the full request duration.
    try:
        if db.in_transaction():
            has_pending_changes = bool(db.new or db.dirty or db.deleted)
            if has_pending_changes:
                logger.warning(
                    "Skipping early auth transaction finalization for user %s due to pending session changes.",
                    getattr(user, "id", "unknown"),
                )
            else:
                await db.commit()
    except Exception as exc:
        logger.warning(
            "Failed to finalize auth transaction for user %s: %s",
            getattr(user, "id", "unknown"),
            exc,
        )
        try:
            await db.rollback()
        except Exception:
            pass

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
