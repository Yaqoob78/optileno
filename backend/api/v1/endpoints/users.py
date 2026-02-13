from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from typing import List, Optional, Any, Dict
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from backend.core.security import get_current_user
from backend.db.database import get_db
from backend.db.models import User, Notification, ChatSession, ChatMessage
from backend.auth.auth_utils import verify_password, get_password_hash
from backend.utils.user_profile import (
    build_user_profile,
    merge_preferences,
    merge_usage_time,
    get_security_settings,
    set_security_settings,
)

router = APIRouter()

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
    new_password: str = Field(..., alias="newPassword", min_length=8)
    confirm_password: str = Field(..., alias="confirmPassword")


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


@router.get("/me")
async def get_user_me(current_user: User = Depends(get_current_user)):
    """Get current user (safe profile response)."""
    return build_user_profile(current_user)


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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.confirmation not in {"DELETE", current_user.email}:
        raise HTTPException(status_code=400, detail="Confirmation text did not match")

    current_user.is_active = False
    await db.commit()
    return {"status": "deleted"}


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
        "free": {"id": "free", "name": "Explorer", "tier": "free", "price": {"monthly": 0, "yearly": 0}},
        "pro": {"id": "pro", "name": "Ultra", "tier": "pro", "price": {"monthly": 9.99, "yearly": 99}},
        "elite": {"id": "elite", "name": "Ultra", "tier": "elite", "price": {"monthly": 9.99, "yearly": 99}},
    }
    current_plan = plan_lookup.get(tier, plan_lookup["free"])

    return {
        "currentPlan": {
            **current_plan,
            "features": profile["subscription"]["features"],
            "limits": {
                "chatHistory": 1000,
                "fileUploads": 0,
                "aiModels": ["default"],
                "supportLevel": "basic",
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


@router.get("/admin/dashboard", tags=["Admin"])
async def get_admin_dashboard(
    current_user: User = Depends(get_current_user)
):
    """Admin-only data dump for debugging/management"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "status": "admin_access_granted",
        "system_stats": {
            "version": "1.0.0",
            "uptime": "Normal"
        }
    }
