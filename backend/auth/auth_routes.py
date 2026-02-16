import secrets
from fastapi import APIRouter, Depends, Response, Request, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from backend.app.config import settings
from backend.db.database import get_db
from backend.schemas.auth import (
    UserRegister,
    UserLogin,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from backend.db.models import User
from backend.utils.user_profile import build_user_profile
from .auth_service import auth_service
from .auth_utils import decode_token

router = APIRouter()

# --- Cookie Settings ---
ACCESS_TOKEN_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
DEFAULT_REFRESH_TOKEN_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth"


def _cookie_kwargs(httponly: bool = True) -> dict:
    kwargs = {
        "httponly": httponly,
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE.lower(),
    }
    if settings.COOKIE_DOMAIN:
        kwargs["domain"] = settings.COOKIE_DOMAIN
    return kwargs


def set_csrf_cookie(response: Response, max_age: int = DEFAULT_REFRESH_TOKEN_MAX_AGE) -> str:
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=max_age,
        path="/",
        **_cookie_kwargs(httponly=False)
    )
    return csrf_token


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    access_max_age: int = ACCESS_TOKEN_MAX_AGE,
    refresh_max_age: int = DEFAULT_REFRESH_TOKEN_MAX_AGE,
):
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=access_max_age,
        path="/",
        **_cookie_kwargs(httponly=True)
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=refresh_max_age,
        path=REFRESH_TOKEN_COOKIE_PATH,
        **_cookie_kwargs(httponly=True)
    )
    set_csrf_cookie(response, max_age=refresh_max_age)


def _delete_cookie(response: Response, key: str, path: str) -> None:
    kwargs = {"path": path}
    if settings.COOKIE_DOMAIN:
        kwargs["domain"] = settings.COOKIE_DOMAIN
    response.delete_cookie(key, **kwargs)


def clear_auth_cookies(response: Response) -> None:
    _delete_cookie(response, "access_token", "/")
    _delete_cookie(response, "refresh_token", REFRESH_TOKEN_COOKIE_PATH)
    _delete_cookie(response, "refresh_token", "/api/v1/auth/refresh")  # Legacy path compatibility
    _delete_cookie(response, "csrf_token", "/")


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    return await auth_service.register(db, user_in)


@router.post("/login")
async def login(
    response: Response,
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Clean login: validates user and sets HttpOnly cookies."""
    user = await auth_service.authenticate(db, login_data)
    access_token, refresh_token, refresh_days = await auth_service.create_session(
        db,
        user.id,
        remember_me=login_data.remember_me
    )
    refresh_max_age = refresh_days * 24 * 60 * 60

    set_auth_cookies(response, access_token, refresh_token, refresh_max_age=refresh_max_age)

    payload = {
        "status": "success",
        "user": build_user_profile(user),
    }

    if settings.DEBUG or settings.ENVIRONMENT != "production":
        payload["access_token"] = access_token
        payload["refresh_token"] = refresh_token

    return payload


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Re-issue tokens using refresh token from cookie."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token"
        )

    access_token, new_refresh_token, refresh_days = await auth_service.refresh_session(db, refresh_token)
    refresh_max_age = refresh_days * 24 * 60 * 60
    set_auth_cookies(response, access_token, new_refresh_token, refresh_max_age=refresh_max_age)

    payload = {"status": "success"}
    if settings.DEBUG or settings.ENVIRONMENT != "production":
        payload["access_token"] = access_token
        payload["refresh_token"] = new_refresh_token
    return payload


@router.post("/forgot-password")
async def forgot_password(
    request_data: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Always return ok to prevent email enumeration.
    """
    forwarded_for = request.headers.get("x-forwarded-for", "")
    request_ip = (forwarded_for.split(",")[0].strip() if forwarded_for else None) or (
        request.client.host if request.client else None
    )
    user_agent = request.headers.get("user-agent")

    await auth_service.request_password_reset(
        db=db,
        email=request_data.email,
        request_ip=request_ip,
        user_agent=user_agent,
    )
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(
    request_data: ResetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.reset_password_with_token(
        db=db,
        token=request_data.token,
        new_password=request_data.new_password,
    )

    # Clear local auth cookies for this browser session after password reset.
    clear_auth_cookies(response)

    return {"ok": True}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Revoke tokens and clear cookies."""
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        await auth_service.logout(db, refresh_token)

    clear_auth_cookies(response)

    return {"status": "success"}


@router.get("/me")
async def get_me(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get current logged in user from access token in cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return build_user_profile(user)


@router.get("/validate")
async def validate_session(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Validate current session and silently restore it via refresh token when possible."""
    token = request.cookies.get("access_token")

    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("user_id")
            token_type = payload.get("type")
            if user_id and token_type == "access":
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user:
                    if not request.cookies.get("csrf_token"):
                        set_csrf_cookie(response)
                    return {"valid": True, "user": build_user_profile(user)}
        except JWTError:
            # Access token expired/invalid; attempt refresh token fallback below.
            pass

    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        return {"valid": False}

    try:
        access_token, new_refresh_token, refresh_days = await auth_service.refresh_session(db, refresh_token)
        refresh_max_age = refresh_days * 24 * 60 * 60
        set_auth_cookies(response, access_token, new_refresh_token, refresh_max_age=refresh_max_age)

        payload = decode_token(access_token)
        user_id = payload.get("user_id")
        if not user_id:
            return {"valid": False}

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return {"valid": False}

        return {"valid": True, "user": build_user_profile(user)}
    except Exception:
        return {"valid": False}
