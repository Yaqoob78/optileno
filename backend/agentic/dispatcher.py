import logging
from typing import Any, Dict

from sqlalchemy import select

from backend.db.database import AsyncSessionLocal
from backend.db.models import User
from .schemas import AgentEvent
from .client import send_event_to_agent
from .enforcement import enforce_decision

logger = logging.getLogger(__name__)


async def dispatch_agent_event(user_id: int, event: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        agent_event = AgentEvent(event=event, payload=payload or {}, user_id=user_id)
        decision = await send_event_to_agent(agent_event)
        enforcement = await enforce_decision(db, user, decision)

        return {
            "decision": decision.model_dump(),
            "enforcement": enforcement,
        }
