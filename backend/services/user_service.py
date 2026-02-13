"""
User service ??? user-related business logic.
"""

from typing import Optional
import logging
from datetime import datetime, timezone
from sqlalchemy import select, update

from backend.app.config import settings
from backend.db.models import User
from backend.db.database import get_db

logger = logging.getLogger(__name__)


class UserService:
    """
    User-related operations.
    """

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        async for db in get_db():
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        async for db in get_db():
            result = await db.execute(select(User).where(User.email == email))
            return result.scalar_one_or_none()

    async def create_user(
        self,
        email: str,
        password: str,
        username: str,
        full_name: Optional[str] = None
    ) -> dict:
        """Create a new user with owner privileges check."""
        from backend.auth.auth_utils import get_password_hash

        async for db in get_db():
            is_owner = bool(settings.OWNER_EMAIL) and email.lower().strip() == settings.OWNER_EMAIL.lower().strip()

            hashed_pw = get_password_hash(password)

            new_user = User(
                email=email,
                username=username,
                hashed_password=hashed_pw,
                full_name=full_name,
                is_active=True,
                # Privilege Escalation for Owner
                is_superuser=True if is_owner else False,
                role="admin" if is_owner else "user",
                tier="elite" if is_owner else "free",
                plan_type="ULTRA" if is_owner else "BASIC"
            )

            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)

            return {
                "id": str(new_user.id),
                "email": new_user.email,
                "username": new_user.username,
                "full_name": new_user.full_name,
                "tier": new_user.tier,
                "role": new_user.role,
                "plan_type": new_user.plan_type
            }

    async def authenticate(self, email: str, password: str) -> Optional[dict]:
        """Authenticate a user."""
        from backend.auth.auth_utils import verify_password

        user = await self.get_by_email(email)
        if not user:
            return None

        if not verify_password(password, user.hashed_password):
            return None

        return {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "tier": user.tier,
            "role": user.role
        }

    async def increment_token_usage(self, user_id: int, provider: str, tokens: int):
        """Increments token usage for a specific provider."""
        async for db in get_db():
            if provider == "gemini":
                stmt = (
                    update(User)
                    .where(User.id == user_id)
                    .values(daily_gemini_tokens=User.daily_gemini_tokens + tokens)
                )
            elif provider == "groq":
                stmt = (
                    update(User)
                    .where(User.id == user_id)
                    .values(daily_groq_tokens=User.daily_groq_tokens + tokens)
                )
            else:
                return

            await db.execute(stmt)
            await db.commit()

    async def reset_daily_tokens(self, user_id: int):
        """Resets daily token counts."""
        async for db in get_db():
            stmt = (
                update(User)
                .where(User.id == user_id)
                .values(
                    daily_gemini_tokens=0,
                    daily_groq_tokens=0,
                    last_token_reset=datetime.now(timezone.utc)
                )
            )
            await db.execute(stmt)
            await db.commit()

# Singleton
user_service = UserService()
