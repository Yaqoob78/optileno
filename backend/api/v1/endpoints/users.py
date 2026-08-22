from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request, Response
from fastapi.responses import FileResponse
from typing import List, Optional, Any, Dict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
import hashlib
import hmac
import json
import logging
import secrets
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from backend.core.security import get_current_user, get_current_active_superuser
from backend.db.database import get_db
from backend.db.models import (
    User,
    Notification,
    ChatSession,
    ChatMessage,
    RefreshToken,
    ApiKey,
    Task,
    Goal,
    Plan,
)
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
        now_iso = datetime.now(timezone.utc).isoformat()
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
                "joinedAt": (getattr(current_user, "created_at", None) or datetime.now(timezone.utc)).isoformat(),
                "lastActiveAt": (getattr(current_user, "updated_at", None) or datetime.now(timezone.utc)).isoformat(),
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


def _describe_device(user_agent: Optional[str]) -> str:
    """Human-readable device label from a user-agent string."""
    ua = (user_agent or "").lower()
    if not ua:
        return "Unknown device"

    if "edg/" in ua or "edge" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua:
        browser = "Safari"
    else:
        browser = "Browser"

    if "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua or "ios" in ua:
        os_name = "iOS"
    elif "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = ""

    return f"{browser} on {os_name}" if os_name else browser


def _current_session_id(request: Request) -> Optional[int]:
    """Session row id ("sid") from the access token. The refresh cookie is
    path-scoped to /auth, so sid is the only session identifier available on
    /users routes. None for API-key auth or legacy tokens issued before sid."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        return None
    try:
        from backend.auth.auth_utils import decode_token
        sid = decode_token(token).get("sid")
        return int(sid) if sid is not None else None
    except Exception:
        return None


async def _get_active_sessions(db: AsyncSession, user_id: int) -> List[RefreshToken]:
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .order_by(RefreshToken.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/me/security")
async def get_security(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prefs = merge_preferences(current_user.preferences or {})
    security = get_security_settings(prefs)

    current_sid = _current_session_id(request)

    sessions = await _get_active_sessions(db, current_user.id)
    security["trustedDevices"] = [
        {
            "id": str(token.id),
            "name": _describe_device(token.user_agent),
            "lastUsed": (token.last_used_at or token.created_at).isoformat()
            if (token.last_used_at or token.created_at) else None,
            "ipAddress": token.ip_address or "",
            "current": token.id == current_sid,
        }
        for token in sessions
    ]
    return security


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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revoke a single session/device by its id (signs that device out)."""
    try:
        token_id = int(device_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=404, detail="Device not found")

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == token_id,
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_revoked == False,  # noqa: E712
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=404, detail="Device not found")

    token.is_revoked = True
    await db.commit()
    return {"status": "revoked", "deviceId": device_id}


@router.post("/me/security/terminate-sessions")
async def terminate_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sign out everywhere else: revoke every session except the current one."""
    stmt = update(RefreshToken).where(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,  # noqa: E712
    )

    current_sid = _current_session_id(request)
    if current_sid is not None:
        stmt = stmt.where(RefreshToken.id != current_sid)

    result = await db.execute(stmt.values(is_revoked=True))
    await db.commit()
    return {"status": "terminated", "revokedCount": result.rowcount or 0}


@router.post("/me/two-factor/enable")
async def enable_two_factor(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Two-factor authentication not implemented")


@router.post("/me/two-factor/disable")
async def disable_two_factor(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Two-factor authentication not implemented")


@router.post("/me/two-factor/verify")
async def verify_two_factor(current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Two-factor authentication not implemented")


API_KEY_PREFIX = "opk_"
MAX_ACTIVE_API_KEYS = 10


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    permissions: List[str] = Field(default_factory=list, max_length=20)


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _serialize_api_key(key: ApiKey) -> Dict[str, Any]:
    return {
        "id": str(key.id),
        "name": key.name,
        "keyPrefix": key.key_prefix,
        "createdAt": key.created_at.isoformat() if key.created_at else None,
        "lastUsed": key.last_used_at.isoformat() if key.last_used_at else None,
        "permissions": key.permissions or [],
    }


@router.get("/me/api-keys")
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id, ApiKey.revoked_at.is_(None))
        .order_by(ApiKey.created_at.desc())
    )
    return [_serialize_api_key(key) for key in result.scalars().all()]


@router.post("/me/api-keys")
async def create_api_key(
    payload: ApiKeyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an API key. The raw secret is returned exactly once."""
    active_count = await db.execute(
        select(func.count())
        .select_from(ApiKey)
        .where(ApiKey.user_id == current_user.id, ApiKey.revoked_at.is_(None))
    )
    if (active_count.scalar() or 0) >= MAX_ACTIVE_API_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"You can have at most {MAX_ACTIVE_API_KEYS} active API keys. Revoke one first.",
        )

    raw_key = API_KEY_PREFIX + secrets.token_hex(20)
    api_key = ApiKey(
        user_id=current_user.id,
        name=payload.name.strip(),
        key_prefix=raw_key[:12],
        hashed_key=_hash_api_key(raw_key),
        permissions=payload.permissions,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return {"id": str(api_key.id), "key": raw_key, **_serialize_api_key(api_key)}


@router.delete("/me/api-keys/{api_key_id}")
async def revoke_api_key(
    api_key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        key_id = int(api_key_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=404, detail="API key not found")

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.user_id == current_user.id,
            ApiKey.revoked_at.is_(None),
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "revoked", "id": api_key_id}


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
            "createdAt": n.created_at.isoformat() if n.created_at else datetime.now(timezone.utc).isoformat(),
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
    notification.read_at = datetime.now(timezone.utc)
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
        .values(is_read=True, read_at=datetime.now(timezone.utc))
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


EXPORT_DIR = Path("data/exports")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_TTL = timedelta(hours=1)


def _export_signature(user_id: int, timestamp: int) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(),
        f"export:{user_id}:{timestamp}".encode(),
        hashlib.sha256,
    ).hexdigest()[:20]


def _row_to_dict(row: Any) -> Dict[str, Any]:
    """Serialize a SQLAlchemy model row to JSON-safe primitives."""
    data: Dict[str, Any] = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        data[column.name] = value
    return data


def _cleanup_expired_exports() -> None:
    """Best-effort removal of export files older than the TTL."""
    cutoff = datetime.now(timezone.utc) - EXPORT_TTL
    try:
        for file in EXPORT_DIR.glob("export_*.json"):
            try:
                parts = file.stem.split("_")
                ts = int(parts[2])
                if datetime.fromtimestamp(ts, tz=timezone.utc) < cutoff:
                    file.unlink()
            except (IndexError, ValueError, OSError):
                continue
    except OSError:
        pass


@router.post("/me/export")
async def export_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assemble the user's data into a downloadable JSON file (link expires in 1 hour)."""
    _cleanup_expired_exports()

    tasks = (await db.execute(
        select(Task).where(Task.user_id == current_user.id)
    )).scalars().all()
    goals = (await db.execute(
        select(Goal).where(Goal.user_id == current_user.id)
    )).scalars().all()
    plans = (await db.execute(
        select(Plan).where(Plan.user_id == current_user.id)
    )).scalars().all()
    sessions = (await db.execute(
        select(ChatSession).where(ChatSession.user_id == current_user.id)
    )).scalars().all()
    session_ids = [s.id for s in sessions]
    messages = []
    if session_ids:
        messages = (await db.execute(
            select(ChatMessage).where(ChatMessage.session_id.in_(session_ids))
        )).scalars().all()

    export_payload = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "profile": build_user_profile(current_user),
        "tasks": [_row_to_dict(t) for t in tasks],
        "goals": [_row_to_dict(g) for g in goals],
        "plans": [_row_to_dict(p) for p in plans],
        "chatSessions": [_row_to_dict(s) for s in sessions],
        "chatMessages": [_row_to_dict(m) for m in messages],
    }

    timestamp = int(datetime.now(timezone.utc).timestamp())
    signature = _export_signature(current_user.id, timestamp)
    filename = f"export_{current_user.id}_{timestamp}_{signature}.json"
    (EXPORT_DIR / filename).write_text(
        json.dumps(export_payload, ensure_ascii=False, default=str), encoding="utf-8"
    )

    expires_at = datetime.now(timezone.utc) + EXPORT_TTL
    return {
        "url": f"/api/v1/users/me/export/{filename}",
        "expiresAt": expires_at.isoformat(),
    }


@router.get("/me/export/{filename}")
async def download_export(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Download a previously generated export. Validates ownership, signature and expiry."""
    invalid = HTTPException(status_code=404, detail="Export not found or expired")

    parts = Path(filename).stem.split("_")
    if len(parts) != 4 or parts[0] != "export" or Path(filename).suffix != ".json":
        raise invalid
    try:
        owner_id = int(parts[1])
        timestamp = int(parts[2])
    except ValueError:
        raise invalid
    signature = parts[3]

    if owner_id != current_user.id:
        raise invalid
    if not hmac.compare_digest(signature, _export_signature(owner_id, timestamp)):
        raise invalid
    if datetime.now(timezone.utc) - datetime.fromtimestamp(timestamp, tz=timezone.utc) > EXPORT_TTL:
        raise invalid

    file_path = EXPORT_DIR / f"export_{owner_id}_{timestamp}_{signature}.json"
    if not file_path.is_file():
        raise invalid

    return FileResponse(
        path=file_path,
        media_type="application/json",
        filename="optileno-data-export.json",
    )


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
