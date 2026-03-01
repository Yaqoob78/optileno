from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import AsyncSessionLocal
from backend.db.models import AccessGrant
from backend.services.entitlements_service import PLAN_EXPLORER, PLAN_ULTRA

logger = logging.getLogger(__name__)

ACCESS_GRANTS_FILE = Path("data/access_grants.json")


def _ensure_storage() -> None:
    ACCESS_GRANTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not ACCESS_GRANTS_FILE.exists():
        ACCESS_GRANTS_FILE.write_text(
            json.dumps({"version": 1, "grants": {}}, indent=2),
            encoding="utf-8",
        )


def _load_payload() -> dict[str, Any]:
    _ensure_storage()
    try:
        raw = json.loads(ACCESS_GRANTS_FILE.read_text(encoding="utf-8") or "{}")
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    grants = raw.get("grants")
    if not isinstance(grants, dict):
        raw["grants"] = {}
    raw.setdefault("version", 1)
    return raw


def _save_payload(payload: dict[str, Any]) -> None:
    _ensure_storage()
    ACCESS_GRANTS_FILE.write_text(
        json.dumps(payload, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _normalize_tier(tier: str) -> str:
    value = (tier or "").strip().lower()
    return PLAN_ULTRA if value == PLAN_ULTRA else PLAN_EXPLORER


def _ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except Exception:
        return None
    return _ensure_utc(parsed)


def _serialize_datetime(value: datetime | None) -> str | None:
    normalized = _ensure_utc(value)
    return normalized.isoformat() if normalized else None


def _finalize_record(record: dict[str, Any] | None, storage: str) -> dict[str, Any] | None:
    if not isinstance(record, dict):
        return None

    expires_at = record.get("expires_at_dt")
    if not isinstance(expires_at, datetime):
        expires_at = _parse_iso_datetime(record.get("expires_at"))

    granted_at = record.get("granted_at_dt")
    if not isinstance(granted_at, datetime):
        granted_at = _parse_iso_datetime(record.get("granted_at"))

    updated_at = record.get("updated_at_dt")
    if not isinstance(updated_at, datetime):
        updated_at = _parse_iso_datetime(record.get("updated_at"))

    revoked_at = record.get("revoked_at_dt")
    if not isinstance(revoked_at, datetime):
        revoked_at = _parse_iso_datetime(record.get("revoked_at"))

    is_currently_active = bool(record.get("active", True))
    if is_currently_active and expires_at and expires_at <= datetime.now(timezone.utc):
        is_currently_active = False

    return {
        "email": _normalize_email(str(record.get("email", ""))),
        "tier": _normalize_tier(str(record.get("tier", PLAN_EXPLORER))),
        "active": bool(record.get("active", True)),
        "granted_at": _serialize_datetime(granted_at),
        "updated_at": _serialize_datetime(updated_at),
        "expires_at": _serialize_datetime(expires_at),
        "revoked_at": _serialize_datetime(revoked_at),
        "reason": record.get("reason"),
        "granted_by_user_id": record.get("granted_by_user_id"),
        "expires_at_dt": expires_at,
        "granted_at_dt": granted_at,
        "updated_at_dt": updated_at,
        "revoked_at_dt": revoked_at,
        "storage": storage,
        "is_currently_active": is_currently_active,
    }


def _serialize_db_record(record: AccessGrant | None) -> dict[str, Any] | None:
    if record is None:
        return None
    return _finalize_record(
        {
            "email": record.email,
            "tier": record.tier,
            "active": record.active,
            "granted_at_dt": _ensure_utc(record.granted_at),
            "updated_at_dt": _ensure_utc(record.updated_at),
            "expires_at_dt": _ensure_utc(record.expires_at),
            "revoked_at_dt": _ensure_utc(record.revoked_at),
            "reason": record.reason,
            "granted_by_user_id": record.granted_by_user_id,
        },
        storage="database",
    )


def _get_legacy_access_grant(email: str) -> dict[str, Any] | None:
    payload = _load_payload()
    grants = payload.get("grants", {})
    if not isinstance(grants, dict):
        return None

    record = grants.get(email)
    if not isinstance(record, dict):
        return None

    return _finalize_record(record, storage="legacy_file")


def _upsert_legacy_access_grant(
    email: str,
    tier: str,
    expires_at: datetime | None = None,
    granted_by_user_id: int | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    payload = _load_payload()
    grants = payload["grants"]
    previous = grants.get(email) if isinstance(grants, dict) else None
    granted_at = previous.get("granted_at") if isinstance(previous, dict) else now.isoformat()
    resolved_reason = reason if reason is not None else (previous.get("reason") if isinstance(previous, dict) else None)
    resolved_granted_by_user_id = (
        granted_by_user_id
        if granted_by_user_id is not None
        else (previous.get("granted_by_user_id") if isinstance(previous, dict) else None)
    )

    grants[email] = {
        "email": email,
        "tier": tier,
        "active": True,
        "granted_at": granted_at,
        "updated_at": now.isoformat(),
        "expires_at": expires_at.isoformat() if expires_at else None,
        "revoked_at": None,
        "reason": resolved_reason,
        "granted_by_user_id": resolved_granted_by_user_id,
    }
    _save_payload(payload)
    return _finalize_record(grants[email], storage="legacy_file") or {}


def _revoke_legacy_access_grant(email: str) -> bool:
    payload = _load_payload()
    grants = payload.get("grants", {})
    if not isinstance(grants, dict):
        return False

    record = grants.get(email)
    if not isinstance(record, dict):
        return False

    now = datetime.now(timezone.utc).isoformat()
    record["active"] = False
    record["updated_at"] = now
    record["revoked_at"] = now
    grants[email] = record
    _save_payload(payload)
    return True


def _list_legacy_access_grants(include_inactive: bool = True) -> list[dict[str, Any]]:
    payload = _load_payload()
    grants = payload.get("grants", {})
    if not isinstance(grants, dict):
        return []

    records: list[dict[str, Any]] = []
    for email, record in sorted(grants.items()):
        if not isinstance(record, dict):
            continue
        serialized = _finalize_record({"email": email, **record}, storage="legacy_file")
        if not serialized:
            continue
        if include_inactive or serialized.get("is_currently_active"):
            records.append(serialized)

    records.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
    return records


def _is_missing_access_grants_table_error(exc: SQLAlchemyError) -> bool:
    raw_message = f"{exc} {getattr(exc, 'orig', '')}".lower()
    return "access_grants" in raw_message and (
        "does not exist" in raw_message
        or "no such table" in raw_message
        or "undefinedtable" in raw_message
    )


async def get_access_grant(email: str, db: AsyncSession) -> dict[str, Any] | None:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None

    try:
        result = await db.execute(
            select(AccessGrant).where(func.lower(AccessGrant.email) == normalized_email)
        )
        return _serialize_db_record(result.scalar_one_or_none())
    except SQLAlchemyError as exc:
        if _is_missing_access_grants_table_error(exc):
            logger.warning(
                "Access grants table unavailable, falling back to %s",
                ACCESS_GRANTS_FILE,
            )
            return _get_legacy_access_grant(normalized_email)
        raise


async def get_active_access_grant(email: str, db: AsyncSession) -> dict[str, Any] | None:
    record = await get_access_grant(email, db)
    if not record or not bool(record.get("is_currently_active")):
        return None
    return record


async def list_access_grants(
    db: AsyncSession,
    include_inactive: bool = True,
) -> list[dict[str, Any]]:
    try:
        stmt = select(AccessGrant).order_by(AccessGrant.updated_at.desc(), AccessGrant.email.asc())
        if not include_inactive:
            stmt = stmt.where(AccessGrant.active.is_(True))
        result = await db.execute(stmt)
        records = [_serialize_db_record(record) for record in result.scalars().all()]
        serialized = [record for record in records if record]
        if include_inactive:
            return serialized
        return [record for record in serialized if record.get("is_currently_active")]
    except SQLAlchemyError as exc:
        if _is_missing_access_grants_table_error(exc):
            logger.warning(
                "Access grants table unavailable, listing grants from %s",
                ACCESS_GRANTS_FILE,
            )
            return _list_legacy_access_grants(include_inactive=include_inactive)
        raise


async def upsert_access_grant(
    email: str,
    tier: str,
    db: AsyncSession,
    expires_at: datetime | None = None,
    granted_by_user_id: int | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        raise ValueError("email is required")

    normalized_tier = _normalize_tier(tier)
    normalized_expires_at = _ensure_utc(expires_at)
    now = datetime.now(timezone.utc)

    try:
        result = await db.execute(
            select(AccessGrant).where(func.lower(AccessGrant.email) == normalized_email)
        )
        record = result.scalar_one_or_none()
        if record is None:
            record = AccessGrant(
                email=normalized_email,
                granted_at=now,
            )
            db.add(record)

        record.email = normalized_email
        record.tier = normalized_tier
        record.active = True
        record.updated_at = now
        record.expires_at = normalized_expires_at
        record.revoked_at = None
        if reason is not None:
            record.reason = reason
        if granted_by_user_id is not None:
            record.granted_by_user_id = granted_by_user_id

        await db.commit()
        await db.refresh(record)
        return _serialize_db_record(record) or {}
    except SQLAlchemyError as exc:
        await db.rollback()
        if _is_missing_access_grants_table_error(exc):
            logger.warning(
                "Access grants table unavailable, writing grant to %s",
                ACCESS_GRANTS_FILE,
            )
            return _upsert_legacy_access_grant(
                email=normalized_email,
                tier=normalized_tier,
                expires_at=normalized_expires_at,
                granted_by_user_id=granted_by_user_id,
                reason=reason,
            )
        raise


async def revoke_access_grant(email: str, db: AsyncSession) -> bool:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return False

    now = datetime.now(timezone.utc)
    try:
        result = await db.execute(
            select(AccessGrant).where(func.lower(AccessGrant.email) == normalized_email)
        )
        record = result.scalar_one_or_none()
        if record is None:
            return False

        record.active = False
        record.updated_at = now
        record.revoked_at = now
        await db.commit()
        return True
    except SQLAlchemyError as exc:
        await db.rollback()
        if _is_missing_access_grants_table_error(exc):
            logger.warning(
                "Access grants table unavailable, revoking grant in %s",
                ACCESS_GRANTS_FILE,
            )
            return _revoke_legacy_access_grant(normalized_email)
        raise


async def _call_with_managed_session(
    func_name: str,
    *args: Any,
    **kwargs: Any,
) -> Any:
    func = globals()[func_name]
    async with AsyncSessionLocal() as session:
        return await func(*args, db=session, **kwargs)


def get_access_grant_sync(email: str) -> dict[str, Any] | None:
    return asyncio.run(_call_with_managed_session("get_access_grant", email))


def get_active_access_grant_sync(email: str) -> dict[str, Any] | None:
    return asyncio.run(_call_with_managed_session("get_active_access_grant", email))


def list_access_grants_sync(include_inactive: bool = True) -> list[dict[str, Any]]:
    return asyncio.run(
        _call_with_managed_session(
            "list_access_grants",
            include_inactive=include_inactive,
        )
    )


def upsert_access_grant_sync(
    email: str,
    tier: str,
    expires_at: datetime | None = None,
    granted_by_user_id: int | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    return asyncio.run(
        _call_with_managed_session(
            "upsert_access_grant",
            email,
            tier,
            expires_at=expires_at,
            granted_by_user_id=granted_by_user_id,
            reason=reason,
        )
    )


def revoke_access_grant_sync(email: str) -> bool:
    return asyncio.run(_call_with_managed_session("revoke_access_grant", email))
