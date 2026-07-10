from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import GrowthEvent, GrowthLead


class GrowthService:
    async def record_event(
        self,
        db: AsyncSession,
        *,
        event_type: str,
        tool: Optional[str] = None,
        anonymous_id: Optional[str] = None,
        lead_email: Optional[str] = None,
        user_id: Optional[int] = None,
        source_path: Optional[str] = None,
        source_url: Optional[str] = None,
        utm: Optional[Dict[str, Any]] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> GrowthEvent:
        event = GrowthEvent(
            event_type=event_type,
            tool=tool,
            anonymous_id=anonymous_id,
            lead_email=(lead_email or "").strip().lower() or None,
            user_id=user_id,
            source_path=source_path,
            source_url=source_url,
            utm=utm or {},
            meta=meta or {},
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event

    async def upsert_lead(
        self,
        db: AsyncSession,
        *,
        email: str,
        tool: str,
        source_path: Optional[str] = None,
        source_url: Optional[str] = None,
        utm: Optional[Dict[str, Any]] = None,
        result_snapshot: Optional[Dict[str, Any]] = None,
        consent: bool = True,
    ) -> GrowthLead:
        normalized_email = (email or "").strip().lower()
        existing_result = await db.execute(
            select(GrowthLead).where(func.lower(GrowthLead.email) == normalized_email)
        )
        lead = existing_result.scalar_one_or_none()

        if lead:
            lead.tool = tool
            lead.source_path = source_path
            lead.source_url = source_url
            lead.utm = utm or {}
            lead.result_snapshot = result_snapshot or {}
            lead.consent = consent
        else:
            lead = GrowthLead(
                email=normalized_email,
                tool=tool,
                source_path=source_path,
                source_url=source_url,
                utm=utm or {},
                result_snapshot=result_snapshot or {},
                consent=consent,
            )
            db.add(lead)

        await db.commit()
        await db.refresh(lead)
        return lead


growth_service = GrowthService()
