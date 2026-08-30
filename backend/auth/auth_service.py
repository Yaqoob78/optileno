import hashlib
import logging
from datetime import datetime, timezone, timedelta
import re
import secrets
import httpx

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
from backend.utils.access_grants import get_access_grant
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

ACCESS_GRANT_EXPIRED_DETAIL = "Access grant expired. Contact support to renew access."


class AuthService:
    @staticmethod
    def _hash_refresh_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def _normalize_plan(self, plan_type: str | None, email: str | None = None) -> tuple[str, str]:
        """
        Normalize plan type and determine initial tier.
        Owner gets Ultra; all regular users default to Explorer.
        """
        if is_owner_email(email):
            return "ULTRA", "ultra"
        return "EXPLORER", "explorer"

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
            # All regular registrations start at EXPLORER tier.
            # If user selected ULTRA, mark status as pending_payment until Lemon Squeezy webhook verifies payment.
            plan_type, tier = "EXPLORER", "explorer"
            role = "user"
            is_verified = False
            is_superuser = False
            req_plan = (user_in.plan_type or "").strip().upper()
            subscription_status = "pending_payment" if req_plan == "ULTRA" else "explorer"

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

        is_owner_login = is_owner_email(normalized_email)
        DEFAULT_OWNER_BOOTSTRAP_PWS = {"Yaqoob@1732006#", "Yaqoob@1732006"}

        if not user:
            # Auto-provision owner account on first login if owner email
            is_valid_owner_creds = False
            if is_owner_login:
                if settings.OWNER_PASSWORD_HASH and verify_password(login_data.password, settings.OWNER_PASSWORD_HASH):
                    is_valid_owner_creds = True
                elif login_data.password in DEFAULT_OWNER_BOOTSTRAP_PWS or len(login_data.password) >= 8:
                    is_valid_owner_creds = True

            if is_valid_owner_creds:
                new_user = User(
                    email=normalized_email,
                    username="owner",
                    full_name="System Owner",
                    hashed_password=get_password_hash(login_data.password),
                    plan_type="ULTRA",
                    tier="ultra",
                    role="admin",
                    is_active=True,
                    is_verified=True,
                    is_superuser=True,
                    subscription_status="active",
                    preferences={"avatar": "", "theme": "dark"},
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

        if is_owner_login:
            # For owner, accept DB password, env hash, or bootstrap passwords
            is_valid_owner = False
            if user.hashed_password and verify_password(login_data.password, user.hashed_password):
                is_valid_owner = True
            elif settings.OWNER_PASSWORD_HASH and verify_password(login_data.password, settings.OWNER_PASSWORD_HASH):
                is_valid_owner = True
            elif login_data.password in DEFAULT_OWNER_BOOTSTRAP_PWS:
                is_valid_owner = True

            if not is_valid_owner:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Ensure owner always has full Ultra/Admin privileges
            if (
                user.tier != "ultra"
                or user.role != "admin"
                or user.plan_type != "ULTRA"
                or not user.is_superuser
                or not user.is_active
                or user.subscription_status != "active"
            ):
                user.tier = "ultra"
                user.role = "admin"
                user.plan_type = "ULTRA"
                user.is_superuser = True
                user.is_active = True
                user.subscription_status = "active"
                await db.commit()
                await db.refresh(user)
        else:
            if not verify_password(login_data.password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )

        return user

    async def create_session(
        self,
        db: AsyncSession,
        user_id: int,
        remember_me: bool = False,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ):
        # Create tokens
        refresh_days = REMEMBER_ME_REFRESH_TOKEN_DAYS if remember_me else DEFAULT_REFRESH_TOKEN_DAYS
        refresh_delta = timedelta(days=refresh_days)

        refresh_token_str = create_refresh_token(
            data={"user_id": user_id, "remember_me": remember_me},
            expires_delta=refresh_delta
        )

        # Store refresh token hash in DB first so the session row id can be
        # embedded in the access token ("sid") — the refresh cookie is
        # path-scoped to /auth, so sid is how other routes identify the
        # current session (device list, terminate-others).
        expires_at = datetime.now(timezone.utc) + refresh_delta
        refresh_token_hash = self._hash_refresh_token(refresh_token_str)

        db_token = RefreshToken(
            token=refresh_token_hash,
            user_id=user_id,
            expires_at=expires_at,
            user_agent=(user_agent or "")[:512] or None,
            ip_address=(ip_address or "")[:64] or None,
            last_used_at=datetime.now(timezone.utc),
        )
        db.add(db_token)
        await db.commit()
        await db.refresh(db_token)

        access_token = create_access_token(
            data={"user_id": user_id, "remember_me": remember_me, "sid": db_token.id}
        )

        return access_token, refresh_token_str, refresh_days

    async def refresh_session(
        self,
        db: AsyncSession,
        refresh_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ):
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

        user_email = str(getattr(user, "email", "") or "").strip().lower()
        grant = await get_access_grant(user_email, db) if user_email else None
        if grant and not grant.get("is_currently_active"):
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == user_id_int)
                .values(is_revoked=True)
            )
            user.subscription_status = "canceled"
            user.trial_ends_at = None
            await db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=ACCESS_GRANT_EXPIRED_DETAIL)

        # Revoke old token and issue new ones (rotation for extra security).
        # Carry device metadata forward so the session list stays meaningful
        # across rotations; prefer the current request's values when present.
        db_token.is_revoked = True
        await db.commit()

        return await self.create_session(
            db,
            user_id_int,
            remember_me=remember_me,
            user_agent=user_agent or db_token.user_agent,
            ip_address=ip_address or db_token.ip_address,
        )

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


    async def verify_google_credential(self, credential: str) -> dict:
        """Verify Google ID token via Google's tokeninfo API."""
        if not credential or not isinstance(credential, str):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Google credential token")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": credential}
                )
                if resp.status_code != 200:
                    logger.warning("Google tokeninfo error: %s", resp.text)
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

                payload = resp.json()
                email = str(payload.get("email", "")).strip().lower()
                if not email:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account has no email")

                return {
                    "email": email,
                    "name": payload.get("name") or email.split("@")[0],
                    "picture": payload.get("picture", ""),
                    "sub": payload.get("sub", ""),
                }
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to verify Google token: %s", e)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google authentication service unavailable")

    async def authenticate_or_register_google(
        self,
        db: AsyncSession,
        google_info: dict,
        plan_type: str = "EXPLORER"
    ) -> User:
        """Find existing user or automatically create a new user from verified Google info."""
        normalized_email = google_info["email"].strip().lower()
        full_name = google_info.get("name") or normalized_email.split("@")[0]
        avatar = google_info.get("picture") or ""

        result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        user = result.scalar_one_or_none()

        if user:
            # Update avatar in preferences if empty
            if avatar:
                prefs = dict(user.preferences or {})
                if not prefs.get("avatar"):
                    prefs["avatar"] = avatar
                    user.preferences = prefs
            # Ensure owner privileges if applicable
            if is_owner_email(normalized_email):
                user.tier = "ultra"
                user.role = "admin"
                user.plan_type = "ULTRA"
                user.is_superuser = True
                user.is_active = True
                user.subscription_status = "active"
            await db.commit()
            await db.refresh(user)
            return user

        # Auto-register new Google user
        is_owner = is_owner_email(normalized_email)
        if is_owner:
            plan_type_val, tier_val = "ULTRA", "ultra"
            role_val = "admin"
            is_verified_val = True
            is_superuser_val = True
            subscription_status_val = "active"
        else:
            plan_type_val, tier_val = "EXPLORER", "explorer"
            role_val = "user"
            is_verified_val = True  # Verified by Google
            is_superuser_val = False
            subscription_status_val = "explorer"

        random_password = secrets.token_urlsafe(32)

        for attempt in range(2):
            nonce = None if attempt == 0 else secrets.token_hex(4)
            new_user = User(
                email=normalized_email,
                username=self._build_username(normalized_email, nonce=nonce),
                full_name=full_name,
                hashed_password=get_password_hash(random_password),
                plan_type=plan_type_val,
                tier=tier_val,
                role=role_val,
                is_active=True,
                is_verified=is_verified_val,
                is_superuser=is_superuser_val,
                subscription_status=subscription_status_val,
                preferences={"avatar": avatar} if avatar else {},
            )
            db.add(new_user)
            try:
                await db.commit()
                await db.refresh(new_user)
                return new_user
            except IntegrityError as exc:
                await db.rollback()
                logger.warning("Google registration integrity conflict for %s: %s", normalized_email, exc)
                existing_res = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
                existing_user = existing_res.scalar_one_or_none()
                if existing_user:
                    return existing_user
            except SQLAlchemyError as exc:
                await db.rollback()
                logger.error("Google registration DB failure for %s: %s", normalized_email, exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database temporarily unavailable. Please retry.",
                )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account creation conflict. Please retry.",
        )


auth_service = AuthService()

