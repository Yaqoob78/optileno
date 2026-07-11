from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

from backend.core.security import get_current_user
from backend.services.chat_service import chat_service
from backend.ai.client import DualAIClient
from backend.realtime.socket_manager import (
    broadcast_message_received,
    broadcast_conversation_updated,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    mode: Optional[str] = "CHAT"
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    intent: Optional[str] = "CHAT"
    actions: Optional[List[Any]] = Field(default_factory=list)
    pending_confirmations: Optional[List[Any]] = Field(default_factory=list)
    session_id: Optional[str] = None
    ui: Optional[Dict[str, Any]] = Field(default_factory=dict)
    data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/send", response_model=ChatResponse)
async def send_message(
    payload: ChatRequest,
    user = Depends(get_current_user)
):
    """
    Send a message to the AI.
    """
    user_id = str(user.id)
    session_id = payload.session_id or None
    
    try:
        # 1. Init Client (Per request for user context)
        ai_client = DualAIClient(user_id=user_id)
        
        # 2. Get history (if not provided or if we want server-side history)
        history = payload.history or []
        if not history and session_id:
            try:
                history = await chat_service.get_history(int(user_id), session_id)
            except Exception as e:
                logger.warning(f"Failed to get history: {e}")
                history = []
        
        # 3. Process
        response = await ai_client.handle_message(
            message=payload.message,
            mode=payload.mode,
            history=history,
            session_id=session_id
        )
        
        # 4. Save to DB (non-blocking)
        if session_id:
            try:
                await chat_service.save_interaction(
                    user_id=int(user_id),
                    session_id=session_id,
                    user_msg=payload.message,
                    ai_msg=response["message"]
                )
            except Exception as e:
                logger.warning(f"Save interaction failed: {e}")

        # 5. Broadcast comprehensive message update to connected clients (single event)
        try:
            await broadcast_message_received(int(user_id), {
                "session_id": session_id,
                "user_message": payload.message,
                "ai_response": response["message"],
                "intent": response.get("intent", "CHAT"),
                "provider": response.get("provider"),
                "model": response.get("model"),
                "message_count": len(history) + 2 if history else 2,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.warning(f"Broadcast failed: {e}")

        # 6. Log analytics event for the interaction
        try:
            from backend.services.analytics_service import analytics_service
            from datetime import datetime, timezone
            await analytics_service.save_event({
                "user_id": int(user_id),
                "event": "chat_interaction",
                "source": "ai_agent",
                "metadata": {
                    "message_length": len(payload.message),
                    "response_length": len(response["message"]),
                    "intent": response.get("intent", "CHAT"),
                    "provider": response.get("provider"),
                    "model": response.get("model"),
                    "actions_executed": len(response.get("actions", [])),
                    "pending_confirmations": len(response.get("pending_confirmations", [])),
                    "has_full_context": response.get("has_full_context", False)
                }
            })
        except Exception as e:
            logger.warning(f"Analytics logging failed: {e}")

        response["session_id"] = session_id
        return response

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        import traceback
        traceback.print_exc()

        # Return a valid response instead of 500 error
        # Make sure to return the proper ChatResponse format
        return ChatResponse(
            message=f"I apologize, I'm experiencing technical difficulties. Please try again.",
            intent="CHAT",
            actions=[],
            pending_confirmations=[],
            session_id=session_id,
            ui={},
            data={},
            provider=None,
            model=None
        )
