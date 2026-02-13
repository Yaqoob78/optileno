# backend/core/validation.py
"""
Input validation and sanitization utilities
"""

import re
import logging
from typing import Any, Dict
from pydantic import BaseModel, validator, Field

logger = logging.getLogger(__name__)


class ValidatedInput(BaseModel):
    """Base class for all input validation"""
    
    class Config:
        extra = "forbid"  # Reject unknown fields
        str_strip_whitespace = True  # Auto-strip whitespace


def validate_title(title: str) -> str:
    """Validate and sanitize title"""
    if not title or not title.strip():
        raise ValueError("Title cannot be empty")
    
    title = title.strip()
    if len(title) > 200:
        raise ValueError("Title must be less than 200 characters")
    
    # Remove potentially malicious characters
    title = re.sub(r'[<>{}"`]', '', title)
    return title


def validate_description(desc: str) -> str:
    """Validate and sanitize description"""
    if not desc:
        return ""
    
    desc = desc.strip()
    if len(desc) > 1000:
        raise ValueError("Description must be less than 1000 characters")
    
    # Remove potentially malicious characters
    desc = re.sub(r'[<>{}"`]', '', desc)
    return desc


def validate_email(email: str) -> str:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValueError("Invalid email format")
    return email.lower().strip()


def validate_password(password: str) -> str:
    """Validate password strength"""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain at least one uppercase letter")
    
    if not re.search(r'[a-z]', password):
        raise ValueError("Password must contain at least one lowercase letter")
    
    if not re.search(r'[0-9]', password):
        raise ValueError("Password must contain at least one digit")
    
    return password


def validate_tags(tags: list) -> list:
    """Validate and sanitize tags"""
    if not isinstance(tags, list):
        raise ValueError("Tags must be a list")
    
    if len(tags) > 10:
        raise ValueError("Maximum 10 tags allowed")
    
    sanitized = []
    for tag in tags:
        if not isinstance(tag, str):
            raise ValueError("Each tag must be a string")
        
        tag = tag.strip()
        if not tag:
            continue
        
        if len(tag) > 50:
            raise ValueError(f"Tag '{tag}' is too long (max 50 chars)")
        
        # Remove special characters except hyphens
        tag = re.sub(r'[^a-zA-Z0-9-]', '', tag)
        if tag:
            sanitized.append(tag.lower())
    
    return list(set(sanitized))  # Remove duplicates


def sanitize_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize JSON data by removing potentially malicious content
    """
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    for key, value in data.items():
        # Skip keys with suspicious patterns
        if any(suspicious in key.lower() for suspicious in ['script', 'eval', '__']):
            logger.warning(f"Suspicious key detected: {key}")
            continue
        
        if isinstance(value, dict):
            sanitized[key] = sanitize_json(value)
        elif isinstance(value, str):
            # Remove script tags and other malicious content
            value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE)
            value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
            sanitized[key] = value
        else:
            sanitized[key] = value
    
    return sanitized


class RequestSizeValidator:
    """Validate request sizes to prevent abuse"""
    
    MAX_JSON_BODY = 1_000_000  # 1 MB
    MAX_FORM_DATA = 50_000_000  # 50 MB
    
    @staticmethod
    def validate_json_size(body_size: int) -> bool:
        """Validate JSON request size"""
        if body_size > RequestSizeValidator.MAX_JSON_BODY:
            logger.warning(f"JSON body too large: {body_size} bytes")
            return False
        return True
    
    @staticmethod
    def validate_form_size(body_size: int) -> bool:
        """Validate form data size"""
        if body_size > RequestSizeValidator.MAX_FORM_DATA:
            logger.warning(f"Form data too large: {body_size} bytes")
            return False
        return True


# Example validated models

class TaskCreateValidated(ValidatedInput):
    """Validated task creation input"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=1000)
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")
    estimated_duration_minutes: int = Field(None, ge=1, le=1440)
    tags: list = Field(default_factory=list, max_items=10)
    
    @validator('title')
    def validate_title_field(cls, v):
        return validate_title(v)
    
    @validator('description')
    def validate_description_field(cls, v):
        return validate_description(v)
    
    @validator('tags')
    def validate_tags_field(cls, v):
        return validate_tags(v)


class UserRegisterValidated(ValidatedInput):
    """Validated user registration input"""
    email: str = Field(...)
    password: str = Field(...)
    full_name: str = Field("", max_length=200)
    
    @validator('email')
    def validate_email_field(cls, v):
        return validate_email(v)
    
    @validator('password')
    def validate_password_field(cls, v):
        return validate_password(v)
