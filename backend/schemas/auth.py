from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserRegister(UserBase):
    password: str = Field(..., min_length=8)
    plan_type: str = "BASIC" # BASIC, PRO

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    plan_type: str # BASIC, PRO
    tier: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    user_id: int
    type: str # access or refresh
    exp: int
