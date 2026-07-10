from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.services.growth_service import growth_service


router = APIRouter()


class GrowthEventRequest(BaseModel):
    event_type: str = Field(..., min_length=2, max_length=80)
    tool: Optional[str] = Field(default=None, max_length=80)
    anonymous_id: Optional[str] = Field(default=None, max_length=120)
    lead_email: Optional[EmailStr] = None
    user_id: Optional[int] = None
    source_path: Optional[str] = Field(default=None, max_length=240)
    source_url: Optional[str] = Field(default=None, max_length=600)
    utm: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)


class GrowthLeadRequest(BaseModel):
    email: EmailStr
    tool: str = Field(..., min_length=2, max_length=80)
    source_path: Optional[str] = Field(default=None, max_length=240)
    source_url: Optional[str] = Field(default=None, max_length=600)
    utm: Dict[str, Any] = Field(default_factory=dict)
    result_snapshot: Dict[str, Any] = Field(default_factory=dict)
    anonymous_id: Optional[str] = Field(default=None, max_length=120)
    consent: bool = True


@router.post("/events")
async def record_growth_event(payload: GrowthEventRequest, db: AsyncSession = Depends(get_db)):
    event = await growth_service.record_event(
        db,
        event_type=payload.event_type,
        tool=payload.tool,
        anonymous_id=payload.anonymous_id,
        lead_email=str(payload.lead_email) if payload.lead_email else None,
        user_id=payload.user_id,
        source_path=payload.source_path,
        source_url=payload.source_url,
        utm=payload.utm,
        meta=payload.meta,
    )
    return {"success": True, "data": {"event_id": event.id}}


@router.post("/leads")
async def capture_growth_lead(payload: GrowthLeadRequest, db: AsyncSession = Depends(get_db)):
    lead = await growth_service.upsert_lead(
        db,
        email=str(payload.email),
        tool=payload.tool,
        source_path=payload.source_path,
        source_url=payload.source_url,
        utm=payload.utm,
        result_snapshot=payload.result_snapshot,
        consent=payload.consent,
    )
    await growth_service.record_event(
        db,
        event_type="email_captured",
        tool=payload.tool,
        anonymous_id=payload.anonymous_id,
        lead_email=lead.email,
        source_path=payload.source_path,
        source_url=payload.source_url,
        utm=payload.utm,
        meta={"lead_id": lead.id},
    )
    return {
        "success": True,
        "data": {
            "lead_id": lead.id,
            "next_url": f"/register?source={payload.tool}",
            "message": "Saved. Create an Optileno account to turn this result into a live planner.",
        },
    }
