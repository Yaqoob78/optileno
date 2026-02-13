from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
from jose import jwt
from passlib.context import CryptContext
from backend.app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed version."""
    # bcrypt has a 72 byte limit. Truncate to 72 bytes to avoid ValueError.
    # This handles legacy passlib behavior where truncation might have been automatic.
    try:
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            plain_password = password_bytes[:72]  # passlib accepts bytes or str
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        # Fallback if other validation errors occur
        return False

def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash of a password."""
    # We must also truncate here to allow users to set 'long' passwords 
    # (which are effectively truncated) without crashing.
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password = password_bytes[:72]
        
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT refresh token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Default to 7 days for refresh tokens
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
