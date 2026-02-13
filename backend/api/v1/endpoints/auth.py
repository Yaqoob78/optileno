from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import timedelta
from typing import Optional

from backend.core.security import get_current_user
from backend.auth.auth_utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token
)
from backend.services.user_service import user_service

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class UserCreate(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None
    plan_type: str = "BASIC"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str]
    tier: str
    role: str
    plan_type: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    existing = await user_service.get_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = await user_service.create_user(
        email=user_data.email,
        username=user_data.username,
        password=user_data.password,
        full_name=user_data.full_name,
    )

    return UserResponse(**user)


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Authenticate user (trigger reload check)
    user = await user_service.authenticate(
        email=form_data.username,
        password=form_data.password
    )

    # Auto-register Owner if missing
    if not user and form_data.username.lower().strip() == "khan011504@gmail.com" and form_data.password == "Yaqoob@1732006#":
        if not await user_service.get_by_email(form_data.username):
            user_data = await user_service.create_user(
                email=form_data.username,
                password=form_data.password,
                username="Owner",
                full_name="Optileno Owner"
            )
            # Map to expected format for token creation
            user = {"id": user_data["id"]}

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"user_id": user["id"]},
        expires_delta=timedelta(minutes=30)
    )

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    return UserResponse(**current_user)
