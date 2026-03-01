from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Response
from typing import List, Optional, Any, Dict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
import logging
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from backend.core.security import get_current_user, get_current_active_superuser
from backend.db.database import get_db
from backend.db.models import User, Notification, ChatSession, ChatMessage
from backend.auth.auth_utils import verify_password, get_password_hash
from backend.app.config import settings
from backend.core.password_policy import validate_password_policy
from backend.schemas.access_grants import (
    AccessGrantListResponse,
    AccessGrantResponse,
    AccessGrantUpsertRequest,
)
from backend.utils.access_grants import (
    list_access_grants,
    revoke_access_grant,
    upsert_access_grant,
)
from backend.utils.user_profile import (
    build_user_profile,
    merge_preferences,
    merge_usage_time,
    get_security_settings,
    set_security_settings,
)

router = APIRouter()
logger = logging.getLogger(__name__)

MEDIA_ROOT = Path("data/media")
AVATAR_DIR = MEDIA_ROOT / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AVATAR_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class UpdatePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    current_password: str = Field(..., alias="currentPassword")
    new_password: str = Field(..., alias="newPassword")
    confirm_password: str = Field(..., alias="confirmPassword")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_policy(value)


class UpdateEmailRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    new_email: EmailStr = Field(..., alias="newEmail")
    current_password: str = Field(..., alias="currentPassword")


class DeleteAccountRequest(BaseModel):
    confirmation: str


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    read: bool
    createdAt: str
    priority: str


def _serialize_access_grant_response(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "email": record.get("email"),
        "tier": record.get("tier"),
        "active": bool(record.get("active", False)),
        "grantedAt": record.get("granted_at"),
        "updatedAt": record.get("updated_at"),
        "expiresAt": record.get("expires_at"),
        "revokedAt": record.get("revoked_at"),
        "reason": record.get("reason"),
        "grantedByUserId": record.get("granted_by_user_id"),
        "storage": record.get("storage") or "database",
        "isCurrentlyActive": bool(record.get("is_currently_active", False)),
    }


@router.get("/me")
async def get_user_me(current_user: User = Depends(get_current_user)):
    """Get current user (safe profile response)."""
    try:
        return build_user_profile(current_user)
    except Exception as exc:
        logger.error("Failed to build user profile for user %s: %s", getattr(current_user, "id", "unknown"), exc, exc_info=True)
        fallback_name = current_user.full_name or (current_user.email.split("@")[0] if current_user.email else "User")
        fallback_tier = (getattr(current_user, "tier", "") or "explorer").strip().lower()
        fallback_plan_type = (getattr(current_user, "plan_type", "") or "EXPLORER").strip().upper()
        now_iso = datetime.utcnow().isoformat()
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": fallback_name,
            "avatar": "",
            "role": "admin" if bool(getattr(current_user, "is_superuser", False)) else "user",
            "planType": fallback_plan_type,
            "plan_tier": fallback_tier,
            "subscription": {
                "tier": fallback_tier,
                "status": getattr(current_user, "subscription_status", None) or "explorer",
                "expiresAt": None,
                "features": [],
            },
            "entitlements": {},
            "limits": {},
            "stats": {
                "totalSessions": 0,
                "totalTokens": 0,
                "avgRating": 0,
                "joinedAt": (getattr(current_user, "created_at", None) or datetime.utcnow()).isoformat(),
                "lastActiveAt": (getattr(current_user, "updated_at", None) or datetime.utcnow()).isoformat(),
                "timeSpentToday": 0,
                "totalTimeSpent": 0,
                "lastActivityAt": now_iso,
            },
            "metadata": {
                "emailVerified": bool(getattr(current_user, "is_verified", False)),
                "twoFactorEnabled": False,
                "accountStatus": "active" if bool(getattr(current_user, "is_active", True)) else "suspended",
                "timezone": "UTC",
                "language": "en",
            },
            "preferences": merge_preferences({}),
        }


@router.patch("/me")
async def update_user_me(
    updates: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user profile and preferences."""
    if updates.email and updates.email != current_user.email:
        existing = await db.execute(select(User).where(User.email == updates.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = updates.email
        current_user.username = updates.email.split("@")[0]

    if updates.name is not None:
        current_user.full_name = updates.name

    prefs = merge_preferences(current_user.preferences or {})
    if updates.avatar is not None:
        prefs["avatar"] = updates.avatar
    if updates.preferences:
        incoming_prefs = dict(updates.preferences)
        if "usageTime" in incoming_prefs:
            usage_time = merge_usage_time(prefs.get("usageTime"), incoming_prefs.get("usageTime"))
            incoming_prefs.pop("usageTime", None)
            if incoming_prefs:
                prefs = merge_preferences(prefs, incoming_prefs)
            prefs["usageTime"] = usage_time
        else:
            prefs = merge_preferences(prefs, incoming_prefs)

    current_user.preferences = prefs

    await db.commit()
    await db.refresh(current_user)
    return build_user_profile(current_user)


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    suffix = Path(file.filename or "avatar.png").suffix
    filename = f"{current_user.id}_{uuid4().hex}{suffix}"
    destination = AVATAR_DIR / filename

    data = await file.read()
    destination.write_bytes(data)

    prefs = merge_preferences(current_user.preferences or {})
    prefs["avatar"] = f"/media/avatars/{filename}"
    current_user.preferences = prefs
    await db.commit()
    await db.refresh(current_user)

    return {"avatarUrl": prefs["avatar"]}


@router.post("/me/password")
async def update_password(
    request: UpdatePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    current_user.hashed_password = get_password_hash(request.new_password)
    await db.commit()
    return {"status": "success"}


@router.post("/me/email")
async def update_email(
    request: UpdateEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    existing = await db.execute(select(User).where(User.email == request.new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already in use")

    current_user.email = request.new_email
    current_user.username = request.new_email.split("@")[0]
    await db.commit()
    await db.refresh(current_user)
    return build_user_profile(current_user)


@router.post("/me/delete")
async def delete_account(
    request: DeleteAccountRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_result = await db.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.confirmation not in {"DELETE", user.email}:
        raise HTTPException(status_code=400, detail="Confirmation text did not match")

    # Best-effort cleanup for uploaded avatar file before deleting account.
    prefs = merge_preferences(user.preferences or {})
    avatar_path = str(prefs.get("avatar") or "")
    if avatar_path.startswith("/media/avatars/"):
        local_avatar = MEDIA_ROOT / avatar_path.replace("/media/", "", 1)
        try:
            if local_avatar.exists() and local_avatar.is_file():
                local_avatar.unlink()
        except Exception:
            # File cleanup failure must not block account data wipe.
            pass

    # Hard delete user row; related records are removed via ON DELETE CASCADE.
    await db.delete(user)
    await db.commit()

    # Clear auth cookies for current browser session.
    cookie_kwargs = {}
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN

    response.delete_cookie("access_token", path="/", **cookie_kwargs)
    response.delete_cookie("refresh_token", path="/api/v1/auth", **cookie_kwargs)
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh", **cookie_kwargs)
    response.delete_cookie("csrf_token", path="/", **cookie_kwargs)

    return {"status": "deleted", "wipe": "complete"}


@router.get("/me/security")
async def get_security(
    current_user: User = Depends(get_current_user)
):
    prefs = merge_preferences(current_user.preferences or {})
    return get_security_settings(prefs)


@router.patch("/me/security")
async def update_security(
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prefs = merge_preferences(current_user.preferences or {})
    prefs = set_security_settings(prefs, updates)
    current_user.preferences = prefs
    await db.commit()
    await db.refresh(current_user)
    return get_security_settings(prefs)


@router.delete("/me/security/devices/{device_id}")
async def revoke_trusted_device(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    # Trusted devices are not persisted yet
    return {"status": "revoked", "deviceId": device_id}


@router.post("/me/security/terminate-sessions")
async def terminate_sessions(
    current_user: User = Depends(get_current_user)
):
    # Session management not implemented
    return {"status": "terminated"}


@router.post("/me/two-factor/enable")
async def enable_two_factor(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Two-factor authentication not implemented")


@router.post("/me/two-factor/disable")
async def disable_two_factor(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Two-factor authentication not implemented")


@router.post("/me/two-factor/verify")
async def verify_two_factor(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Two-factor authentication not implemented")


@router.get("/me/api-keys")
async def list_api_keys(current_user: User = Depends(get_current_user)):
    return []


@router.post("/me/api-keys")
async def create_api_key(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="API keys not implemented")


@router.delete("/me/api-keys/{api_key_id}")
async def revoke_api_key(api_key_id: str, current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="API keys not implemented")


@router.get("/me/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    read: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
):
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if read is not None:
        stmt = stmt.where(Notification.is_read == read)
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(stmt)
    notifications = result.scalars().all()

    return [
        {
            "id": str(n.id),
            "type": n.notification_type,
            "title": n.title,
            "message": n.message,
            "read": bool(n.is_read),
            "createdAt": n.created_at.isoformat() if n.created_at else datetime.utcnow().isoformat(),
            "priority": n.priority,
        }
        for n in notifications
    ]


@router.patch("/me/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.id == notification_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    return {"status": "success"}


@router.post("/me/notifications/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()
    return {"status": "success"}


@router.delete("/me/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.id == notification_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()
    return {"status": "success"}


@router.get("/me/activity")
async def get_activity_logs(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    # Activity logging is not yet persisted; return empty list for now.
    return []


@router.post("/me/export")
async def export_data(current_user: User = Depends(get_current_user)):
    # Placeholder for data export workflow
    return {
        "url": "",
        "expiresAt": (datetime.utcnow()).isoformat(),
    }


@router.get("/me/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_chats = await db.execute(
        select(func.count()).select_from(ChatSession).where(ChatSession.user_id == current_user.id)
    )
    total_chats = total_chats.scalar() or 0

    total_tokens = await db.execute(
        select(func.coalesce(func.sum(ChatMessage.tokens), 0))
        .select_from(ChatMessage)
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == current_user.id)
    )
    total_tokens = total_tokens.scalar() or 0

    return {
        "totalChats": total_chats,
        "totalTokens": total_tokens,
        "averageRating": 0,
        "dailyActivity": [],
        "mostUsedFeatures": [],
        "achievements": [],
    }


@router.get("/me/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user)
):
    profile = build_user_profile(current_user)
    tier = profile["subscription"]["tier"]

    plan_lookup = {
        "explorer": {"id": "explorer", "name": "Explorer", "tier": "explorer", "price": {"monthly": 0, "yearly": 0}},
        "ultra": {"id": "ultra", "name": "Ultra", "tier": "ultra", "price": {"monthly": 9.99, "yearly": 99}},
    }
    current_plan = plan_lookup.get(tier, plan_lookup["explorer"])

    support_level = "priority" if tier == "ultra" else "basic"

    return {
        "currentPlan": {
            **current_plan,
            "features": profile["subscription"]["features"],
            "limits": {
                "chatHistory": 1000,
                "fileUploads": 0,
                "aiModels": ["default"],
                "supportLevel": support_level,
            },
        },
        "nextBillingDate": None,
        "paymentMethod": None,
        "usage": {
            "chatTokens": {"used": 0, "total": 0},
            "fileStorage": {"used": 0, "total": 0},
            "apiCalls": {"used": 0, "total": 0},
        },
        "history": [],
    }


@router.get("/admin/access-grants", response_model=AccessGrantListResponse, tags=["Admin"])
async def get_admin_access_grants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    records = await list_access_grants(db, include_inactive=True)
    grants = [_serialize_access_grant_response(record) for record in records]
    return {"grants": grants, "total": len(grants)}


@router.post("/admin/access-grants", response_model=AccessGrantResponse, tags=["Admin"])
async def create_admin_access_grant(
    payload: AccessGrantUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    expires_at = payload.expiresAt
    if payload.days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.days)

    record = await upsert_access_grant(
        email=str(payload.email),
        tier=payload.tier,
        db=db,
        expires_at=expires_at,
        granted_by_user_id=current_user.id,
        reason=payload.reason,
    )
    return _serialize_access_grant_response(record)


@router.delete("/admin/access-grants/{email:path}", tags=["Admin"])
async def delete_admin_access_grant(
    email: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    del current_user
    success = await revoke_access_grant(email, db)
    if not success:
        raise HTTPException(status_code=404, detail="Access grant not found")

    return {"status": "revoked", "email": str(email).strip().lower()}


@router.get("/admin/dashboard", tags=["Admin"])
async def get_admin_dashboard(
    current_user: User = Depends(get_current_active_superuser)
):
    """Admin-only data dump for debugging/management"""
    return {
        "status": "admin_access_granted",
        "system_stats": {
            "version": "1.0.0",
            "uptime": "Normal"
        }
    }
