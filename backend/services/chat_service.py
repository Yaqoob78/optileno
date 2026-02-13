from typing import List, Dict, Any, Optional
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

class ChatService:
    """
    Chat persistence service.
    """

    async def get_history(self, session_id: str) -> List[Dict[str, str]]:
        """Retrieve chat history for context."""
        history = []
        if not session_id:
            return history

        async for db in get_db():
            # Find session
            result = await db.execute(select(ChatSession).where(ChatSession.session_id == session_id))
            session = result.scalar_one_or_none()
            
            if session:
                # Find messages
                # Ordering by created_at asc
                msgs_result = await db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == session.id)
                    .order_by(ChatMessage.created_at)
                )
                messages = msgs_result.scalars().all()
                
                for msg in messages:
                    history.append({"role": msg.role, "content": msg.content})
            
            return history # Return after first db yield

    async def save_interaction(self, user_id: int, session_id: str, user_msg: str, ai_msg: str):
        """Save the exchange to DB."""
        if not session_id:
            return

        async for db in get_db():
            # 1. Get or Create Session
            result = await db.execute(select(ChatSession).where(ChatSession.session_id == session_id))
            session = result.scalar_one_or_none()
            
            if not session:
                session = ChatSession(
                    session_id=session_id,
                    user_id=user_id,
                    title=user_msg[:50] # Simple title
                )
                db.add(session)
                await db.commit()
                await db.refresh(session)
            
            # 2. Save User Message
            user_message = ChatMessage(
                session_id=session.id,
                role="user",
                content=user_msg
            )
            db.add(user_message)
            
            # 3. Save AI Message
            ai_message = ChatMessage(
                session_id=session.id,
                role="assistant", 
                content=ai_msg
            )
            db.add(ai_message)
            
            await db.commit()

# Singleton
chat_service = ChatService()
