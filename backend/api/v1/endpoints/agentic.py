from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional

from backend.core.security import get_current_user
from backend.db.models import User
from backend.agentic.dispatcher import dispatch_agent_event

router = APIRouter()


class AgentDispatchRequest(BaseModel):
    event: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    user_id: Optional[int] = None


@router.post("/dispatch")
async def dispatch_event(
    body: AgentDispatchRequest,
    current_user: User = Depends(get_current_user)
):
    target_user_id = body.user_id or current_user.id
    if target_user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Forbidden")

    result = await dispatch_agent_event(
        user_id=target_user_id,
        event=body.event,
        payload=body.payload or {},
    )
    return result
