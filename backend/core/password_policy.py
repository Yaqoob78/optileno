"""
Shared password policy validation for auth flows.
"""

from __future__ import annotations

import re

PASSWORD_POLICY_MESSAGE = (
    "Password must be at least 8 characters and include at least 1 letter and 1 number."
)

_HAS_LETTER = re.compile(r"[A-Za-z]")
_HAS_NUMBER = re.compile(r"\d")


def validate_password_policy(password: str) -> str:
    """
    Enforce a minimal strong-password policy:
    - at least 8 characters
    - at least one letter
    - at least one number
    """
    candidate = password or ""
    if (
        len(candidate) < 8
        or _HAS_LETTER.search(candidate) is None
        or _HAS_NUMBER.search(candidate) is None
    ):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return candidate
