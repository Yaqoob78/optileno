import hashlib
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status
from jose import JWTError

from backend.app.config import settings
from backend.db.models import User, RefreshToken
from backend.schemas.auth import UserRegister, UserLogin
from .auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)


class AuthService:
    @staticmethod
    def _hash_refresh_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def _normalize_plan(self, plan_type: str | None) -> tuple[str, str]:
        """
        Normalize plan type and determine initial tier.
        For Explorer, we might start them as 'free' until they complete payment setup for trial,
        or 'trialing' if no payment setup is required immediately.
        Given the Razorpay flow usually requires an order, we'll default to 'BASIC'/'free' 
        and let them subscribe via the frontend to activate the trial/plan.
        """
        plan_raw = (plan_type or "BASIC").upper()

        # Owner plan (handled in caller usually, but good to have)
        if plan_raw == "OWNER":
            return "ULTRA", "elite"

        # Valid plans
        if plan_raw in {"EXPLORER", "BASIC"}:
            return "BASIC", "free"  # User upgrades to Explorer (and gets trial) via payment flow
            
        if plan_raw in {"ULTRA", "PRO", "ENTERPRISE"}:
            # Ultra requires payment/subscription, so initial auth/register 
            # without payment defaults to BASIC/free unless it's the owner checking in.
            return "BASIC", "free"

        return "BASIC", "free"

    async def register(self, db: AsyncSession, user_in: UserRegister):
        # Check if email exists
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Check if this is the first user (make them admin/owner-like if so, optional logic)
        # But we strictly follow settings.OWNER_EMAIL for the real owner.
        is_owner = (user_in.email.lower().strip() == settings.OWNER_EMAIL.lower().strip()) if settings.OWNER_EMAIL else False
        
        # Determine plan
        if is_owner:
            plan_type, tier = "ULTRA", "elite"
            role = "admin"
            is_verified = True
            is_superuser = True
        else:
            plan_type, tier = self._normalize_plan(user_in.plan_type)
            role = "user"
            is_verified = False 
            is_superuser = False

        # Create new user
        new_user = User(
            email=user_in.email,
            username=user_in.email.split('@')[0], # Fallback username
            full_name=user_in.full_name,
            hashed_password=get_password_hash(user_in.password),
            plan_type=plan_type,
            tier=tier,
            role=role,
            is_active=True,
            is_verified=is_verified,
            is_superuser=is_superuser,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    async def authenticate(self, db: AsyncSession, login_data: UserLogin):
        result = await db.execute(select(User).where(User.email == login_data.email))
        user = result.scalar_one_or_none()

        # Check if this is the owner trying to log in
        is_owner_email = (settings.OWNER_EMAIL and login_data.email.lower().strip() == settings.OWNER_EMAIL.lower().strip())

        if not user:
            # If owner email but no account, auto-provision
            if is_owner_email and settings.OWNER_PASSWORD_HASH:
                if verify_password(login_data.password, settings.OWNER_PASSWORD_HASH):
                    # Create owner account with full privileges
                    new_user = User(
                        email=login_data.email,
                        username="owner",
                        full_name="System Owner",
                        hashed_password=settings.OWNER_PASSWORD_HASH,
                        plan_type="ULTRA",
                        tier="elite",
                        role="admin",
                        is_active=True,
                        is_verified=True,
                        is_superuser=True
                    )
                    db.add(new_user)
                    await db.commit()
                    await db.refresh(new_user)
                    return new_user

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # For owner, verify against env hash; for others, verify stored hash
        if is_owner_email:
            if not verify_password(login_data.password, settings.OWNER_PASSWORD_HASH):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            # Ensure owner always has full privileges
            # Force update if permissions are missing or outdated
            if user.tier != "elite" or user.role != "admin" or user.plan_type != "ULTRA" or not user.is_superuser:
                user.tier = "elite"
                user.role = "admin"
                user.plan_type = "ULTRA"
                user.is_superuser = True
                await db.commit()
                await db.refresh(user) # Refresh to get updated fields
        else:
            if not verify_password(login_data.password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect request", # Generic error for security
                    headers={"WWW-Authenticate": "Bearer"},
                )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )

        return user

    async def create_session(self, db: AsyncSession, user_id: int):
        # Create tokens
        access_token = create_access_token(data={"user_id": user_id})
        refresh_token_str = create_refresh_token(data={"user_id": user_id})

        # Store refresh token hash in DB
        # Default expiry 7 days
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        refresh_token_hash = self._hash_refresh_token(refresh_token_str)

        db_token = RefreshToken(
            token=refresh_token_hash,
            user_id=user_id,
            expires_at=expires_at
        )
        db.add(db_token)
        await db.commit()

        return access_token, refresh_token_str

    async def refresh_session(self, db: AsyncSession, refresh_token: str):
        try:
            payload = decode_token(refresh_token)
            user_id = payload.get("user_id")
            token_type = payload.get("type")

            if not user_id or token_type != "refresh":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        refresh_token_hash = self._hash_refresh_token(refresh_token)

        # Check DB for token
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token_hash,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
        )
        db_token = result.scalar_one_or_none()

        if not db_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

        # Revoke old token and issue new ones (rotation for extra security)
        db_token.is_revoked = True
        await db.commit()

        return await self.create_session(db, user_id)

    async def logout(self, db: AsyncSession, refresh_token: str):
        if not refresh_token:
            return

        refresh_token_hash = self._hash_refresh_token(refresh_token)

        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token == refresh_token_hash)
            .values(is_revoked=True)
        )
        await db.commit()


auth_service = AuthService()
