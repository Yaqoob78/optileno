import pytest
import asyncio
from backend.ai.client import DualAIClient
from backend.db.database import get_db, init_db
from backend.db.models import User
from sqlalchemy import select

@pytest.mark.asyncio
async def test_leno_chat_resilience():
    await init_db()
    async for db in get_db():
        # Get or create a test user
        res = await db.execute(select(User).limit(1))
        user = res.scalar_one_or_none()
        if not user:
            user = User(email="leno_test@optileno.com", password_hash="dummy", full_name="Leno Tester", plan_type="ULTRA", role="user")
            db.add(user)
            await db.commit()
            await db.refresh(user)

        user_id = str(user.id)
        break

    client = DualAIClient(user_id=user_id)
    
    # 1. Test standard greeting
    response = await client.handle_message("hi")
    assert response is not None
    assert "message" in response
    assert len(response["message"]) > 0
    assert "trouble connecting" not in response["message"].lower()

    # 2. Test planning inquiry
    response2 = await client.handle_message("what tasks should i do today?")
    assert response2 is not None
    assert "message" in response2
    assert len(response2["message"]) > 0
    assert "trouble connecting" not in response2["message"].lower()

    # 3. Test goals inquiry
    response3 = await client.handle_message("show my goals")
    assert response3 is not None
    assert "message" in response3
    assert len(response3["message"]) > 0
    assert "trouble connecting" not in response3["message"].lower()
