import hashlib
import logging
from datetime import datetime, timezone, timedelta
import re
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import HTTPException, status
from jose import JWTError

from backend.app.config import settings
from backend.db.models import User, RefreshToken, PasswordResetToken
from backend.schemas.auth import UserRegister, UserLogin
from backend.services.email_service import email_service
from backend.services.entitlements_service import normalize_plan_tier, canonical_plan_type
from backend.utils.owner import is_owner_email
from backend.core.password_policy import (
    PASSWORD_POLICY_MESSAGE,
    validate_password_policy,
)
from .auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    hash_token,
)

logger = logging.getLogger(__name__)

DEFAULT_REFRESH_TOKEN_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS
REMEMBER_ME_REFRESH_TOKEN_DAYS = max(settings.REFRESH_TOKEN_EXPIRE_DAYS, 30)


class AuthService:
    @staticmethod
    def _hash_refresh_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def _normalize_plan(self, plan_type: str | None) -> tuple[str, str]:
        """
        Normalize plan type and determine initial tier.
        Default new users to canonical Explorer tier and let billing flows
        upgrade to Ultra when payment activates.
        """
        normalized = normalize_plan_tier(plan_type=plan_type)
        return canonical_plan_type(normalized), normalized

    @staticmethod
    def _username_seed(email: str) -> str:
        local = (email.split("@")[0] if "@" in email else email).strip().lower()
        cleaned = re.sub(r"[^a-z0-9._-]+", "_", local).strip("._-")
        if not cleaned:
            cleaned = "user"
        return cleaned[:20]

    def _build_username(self, email: str, nonce: str | None = None) -> str:
        seed = self._username_seed(email)
        fingerprint_source = f"{email}|{nonce or ''}"
        suffix = hashlib.sha1(fingerprint_source.encode("utf-8")).hexdigest()[:8]
        return f"{seed}_{suffix}"

    async def register(self, db: AsyncSession, user_in: UserRegister):
        normalized_email = str(user_in.email).strip().lower()

        # Check if email exists
        try:
            result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        except SQLAlchemyError as exc:
            logger.error("Registration query failed for %s: %s", normalized_email, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database temporarily unavailable. Please retry registration.",
            )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Owner account always gets full privileges.
        is_owner = is_owner_email(normalized_email)

        if is_owner:
            plan_type, tier = "ULTRA", "ultra"
            role = "admin"
            is_verified = True
            is_superuser = True
            subscription_status = "active"
        else:
            # Store the user's SELECTED plan but mark as pending_payment.
            # They must complete Cashfree payment to activate their plan.
            # Trial starts AFTER payment, not before.
            plan_type, tier = self._normalize_plan(user_in.plan_type)
            role = "user"
            is_verified = False
            is_superuser = False
            subscription_status = "pending_payment"

        # Create new user with collision-safe username and graceful integrity retries.
        for attempt in range(2):
            nonce = None if attempt == 0 else secrets.token_hex(4)
            new_user = User(
                email=normalized_email,
                username=self._build_username(normalized_email, nonce=nonce),
                full_name=user_in.full_name,
                hashed_password=get_password_hash(user_in.password),
                plan_type=plan_type,
                tier=tier,
                role=role,
                is_active=True,
                is_verified=is_verified,
                is_superuser=is_superuser,
                subscription_status=subscription_status,
            )
            db.add(new_user)
            try:
                await db.commit()
                await db.refresh(new_user)
                return new_user
            except IntegrityError as exc:
                await db.rollback()
                logger.warning("Registration integrity conflict for %s: %s", normalized_email, exc)
                existing_result = await db.execute(
                    select(User).where(func.lower(User.email) == normalized_email)
                )
                if existing_result.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email already registered",
                    )
                if attempt == 1:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Account creation conflict. Please retry registration.",
                    )
            except SQLAlchemyError as exc:
                await db.rollback()
                logger.error("Registration DB failure for %s: %s", normalized_email, exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database temporarily unavailable. Please retry registration.",
                )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account creation conflict. Please retry registration.",
        )

    async def authenticate(self, db: AsyncSession, login_data: UserLogin):
        normalized_email = str(login_data.email).strip().lower()
        result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        user = result.scalar_one_or_none()

        # Check if this is the owner trying to log in
        is_owner_login = is_owner_email(normalized_email)

        if not user:
            # If owner email but no account, auto-provision
            if is_owner_login and settings.OWNER_PASSWORD_HASH:
                if verify_password(login_data.password, settings.OWNER_PASSWORD_HASH):
                    # Create owner account with full privileges
                    new_user = User(
                        email=normalized_email,
                        username="owner",
                        full_name="System Owner",
                        hashed_password=settings.OWNER_PASSWORD_HASH,
                        plan_type="ULTRA",
                        tier="ultra",
                        role="admin",
                        is_active=True,
                        is_verified=True,
                        is_superuser=True,
                        subscription_status="active",
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
        if is_owner_login:
            if settings.OWNER_PASSWORD_HASH:
                if not verify_password(login_data.password, settings.OWNER_PASSWORD_HASH):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            else:
                # Fallback for environments where OWNER_PASSWORD_HASH is missing.
                if not verify_password(login_data.password, user.hashed_password):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            # Ensure owner always has full privileges
            # Force update if permissions are missing or outdated
            if user.tier != "ultra" or user.role != "admin" or user.plan_type != "ULTRA" or not user.is_superuser:
                user.tier = "ultra"
                user.role = "admin"
                user.plan_type = "ULTRA"
                user.is_superuser = True
                await db.commit()
                await db.refresh(user)  # Refresh to get updated fields
        else:
            if not verify_password(login_data.password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect request",  # Generic error for security
                    headers={"WWW-Authenticate": "Bearer"},
                )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )

        return user

    async def create_session(self, db: AsyncSession, user_id: int, remember_me: bool = False):
        # Create tokens
        refresh_days = REMEMBER_ME_REFRESH_TOKEN_DAYS if remember_me else DEFAULT_REFRESH_TOKEN_DAYS
        refresh_delta = timedelta(days=refresh_days)

        access_token = create_access_token(data={"user_id": user_id, "remember_me": remember_me})
        refresh_token_str = create_refresh_token(
            data={"user_id": user_id, "remember_me": remember_me},
            expires_delta=refresh_delta
        )

        # Store refresh token hash in DB
        expires_at = datetime.now(timezone.utc) + refresh_delta
        refresh_token_hash = self._hash_refresh_token(refresh_token_str)

        db_token = RefreshToken(
            token=refresh_token_hash,
            user_id=user_id,
            expires_at=expires_at
        )
        db.add(db_token)
        await db.commit()

        return access_token, refresh_token_str, refresh_days

    async def refresh_session(self, db: AsyncSession, refresh_token: str):
        try:
            payload = decode_token(refresh_token)
            user_id = payload.get("user_id")
            token_type = payload.get("type")
            remember_me = bool(payload.get("remember_me", False))

            if not user_id or token_type != "refresh":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            user_id_int = int(user_id)
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        except (TypeError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        refresh_token_hash = self._hash_refresh_token(refresh_token)

        # Check DB for token
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token_hash,
                RefreshToken.user_id == user_id_int,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
            .with_for_update()
        )
        db_token = result.scalar_one_or_none()

        if not db_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

        user_result = await db.execute(select(User).where(User.id == user_id_int))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        # Revoke old token and issue new ones (rotation for extra security)
        db_token.is_revoked = True
        await db.commit()

        return await self.create_session(db, user_id_int, remember_me=remember_me)

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

    async def revoke_all_refresh_tokens(self, db: AsyncSession, user_id: int):
        """Revoke all refresh tokens for a user."""
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(is_revoked=True)
        )

    async def request_password_reset(
        self,
        db: AsyncSession,
        email: str,
        request_ip: str | None = None,
        user_agent: str | None = None,
    ):
        """
        Create reset token and send email if account exists.
        Caller should always return a generic success response.
        """
        normalized_email = (email or "").strip().lower()
        if not normalized_email:
            return

        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            return

        now = datetime.now(timezone.utc)

        # Invalidate previous unused tokens for this user.
        await db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=now)
        )

        raw_token = generate_reset_token()
        reset_entry = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
            request_ip=(request_ip or "")[:255] or None,
            user_agent=(user_agent or "")[:1024] or None,
        )
        db.add(reset_entry)
        await db.commit()

        await self._send_password_reset_email(user.email, raw_token)

    async def reset_password_with_token(self, db: AsyncSession, token: str, new_password: str):
        """Consume a reset token once, change password, and revoke all sessions."""
        if not token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token is required")

        try:
            validate_password_policy(new_password)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=PASSWORD_POLICY_MESSAGE,
            )

        now = datetime.now(timezone.utc)
        token_digest = hash_token(token)

        result = await db.execute(
            select(PasswordResetToken)
            .where(
                PasswordResetToken.token_hash == token_digest,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
            .with_for_update()
        )
        reset_entry = result.scalar_one_or_none()
        if not reset_entry:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

        user_result = await db.execute(
            select(User)
            .where(User.id == reset_entry.user_id)
            .with_for_update()
        )
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset request")

        user.hashed_password = get_password_hash(new_password)
        reset_entry.used_at = now
        await self.revoke_all_refresh_tokens(db, user.id)
        await db.commit()

    async def _send_password_reset_email(self, to_email: str, raw_token: str):
        app_url = (settings.APP_URL or settings.FRONTEND_URL or "").rstrip("/")
        reset_link = f"{app_url}/reset-password?token={raw_token}" if app_url else raw_token

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Reset your Optileno password</h2>
                <p>We received a request to reset your password.</p>
                <p>
                    <a href="{reset_link}" style="background-color: #2563eb; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px;">
                        Reset Password
                    </a>
                </p>
                <p>This link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
                <p>If you did not request this, you can ignore this email.</p>
            </body>
        </html>
        """

        try:
            result = await email_service.send_email(
                to_email=to_email,
                subject="Reset your Optileno password",
                html_content=html_content,
                text_content=f"Reset your password: {reset_link}",
            )
            if result.get("status") != "sent":
                # Keep flow non-blocking to avoid user enumeration and delivery retries issues.
                logger.warning("Password reset email delivery failed for %s: %s", to_email, result)
        except Exception as exc:
            # Intentionally swallow to keep forgot-password response constant.
            logger.warning("Password reset email send exception for %s: %s", to_email, exc)


auth_service = AuthService()
