import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

import httpx

from backend.app.config import settings
from .schemas import AgentEvent, AgentDecision

logger = logging.getLogger(__name__)


def _sign_payload(payload: bytes, timestamp: str, secret: str) -> str:
    mac = hmac.new(secret.encode(), digestmod=hashlib.sha256)
    mac.update(timestamp.encode())
    mac.update(b".")
    mac.update(payload)
    return mac.hexdigest()


async def send_event_to_agent(event: AgentEvent) -> AgentDecision:
    if not settings.AGENT_ENABLED or not settings.AGENT_ENDPOINT:
        return AgentDecision(decision="NO_ACTION")

    body = event.model_dump()
    body["event_id"] = str(uuid4())
    body["sent_at"] = datetime.now(timezone.utc).isoformat()

    payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))

    headers = {
        "Content-Type": "application/json",
        "X-Optileno-Timestamp": timestamp,
    }

    if settings.AGENT_SHARED_SECRET:
        headers["Authorization"] = f"Bearer {settings.AGENT_SHARED_SECRET}"
        headers["X-Optileno-Signature"] = _sign_payload(payload, timestamp, settings.AGENT_SHARED_SECRET)

    try:
        async with httpx.AsyncClient(timeout=settings.AGENT_TIMEOUT_SECONDS) as client:
            response = await client.post(settings.AGENT_ENDPOINT, content=payload, headers=headers)

        if response.status_code >= 400:
            logger.warning(f"Agent endpoint error: {response.status_code} {response.text}")
            return AgentDecision(decision="NO_ACTION")

        data = response.json()
        return AgentDecision.model_validate(data)
    except Exception as exc:
        logger.error(f"Agent call failed: {exc}")
        return AgentDecision(decision="NO_ACTION")
