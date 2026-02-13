import secrets
from fastapi import APIRouter, Depends, Response, Request, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from backend.app.config import settings
from backend.db.database import get_db
from backend.schemas.auth import UserRegister, UserLogin, UserResponse
from backend.db.models import User
from backend.utils.user_profile import build_user_profile
from .auth_service import auth_service
from .auth_utils import decode_token

router = APIRouter()

# --- Cookie Settings ---
ACCESS_TOKEN_MAX_AGE = 30 * 60  # 30 minutes
REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _cookie_kwargs(httponly: bool = True) -> dict:
    kwargs = {
        "httponly": httponly,
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE.lower(),
    }
    if settings.COOKIE_DOMAIN:
        kwargs["domain"] = settings.COOKIE_DOMAIN
    return kwargs


def set_csrf_cookie(response: Response) -> str:
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/",
        **_cookie_kwargs(httponly=False)
    )
    return csrf_token


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
        **_cookie_kwargs(httponly=True)
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/api/v1/auth/refresh",  # Only sent to refresh endpoint
        **_cookie_kwargs(httponly=True)
    )
    set_csrf_cookie(response)


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
    access_token, refresh_token = await auth_service.create_session(db, user.id)

    set_auth_cookies(response, access_token, refresh_token)

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

    access_token, new_refresh_token = await auth_service.refresh_session(db, refresh_token)
    set_auth_cookies(response, access_token, new_refresh_token)

    payload = {"status": "success"}
    if settings.DEBUG or settings.ENVIRONMENT != "production":
        payload["access_token"] = access_token
        payload["refresh_token"] = new_refresh_token
    return payload


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

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")

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
    """Validate current session without throwing on failure."""
    token = request.cookies.get("access_token")
    if not token:
        return {"valid": False}

    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            return {"valid": False}
    except JWTError:
        return {"valid": False}

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"valid": False}

    # Ensure CSRF cookie exists
    if not request.cookies.get("csrf_token"):
        set_csrf_cookie(response)

    return {"valid": True, "user": build_user_profile(user)}
