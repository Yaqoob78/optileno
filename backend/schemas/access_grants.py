from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class AccessGrantUpsertRequest(BaseModel):
    email: EmailStr
    tier: Literal["explorer", "ultra"] = "explorer"
    days: int | None = Field(default=None, ge=1, le=3650)
    expiresAt: datetime | None = None
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_expiry_inputs(self) -> "AccessGrantUpsertRequest":
        if self.days is not None and self.expiresAt is not None:
            raise ValueError("Provide either days or expiresAt, not both")
        return self


class AccessGrantResponse(BaseModel):
    email: EmailStr
    tier: Literal["explorer", "ultra"]
    active: bool
    grantedAt: str | None = None
    updatedAt: str | None = None
    expiresAt: str | None = None
    revokedAt: str | None = None
    reason: str | None = None
    grantedByUserId: int | None = None
    storage: str
    isCurrentlyActive: bool


class AccessGrantListResponse(BaseModel):
    grants: list[AccessGrantResponse]
    total: int
