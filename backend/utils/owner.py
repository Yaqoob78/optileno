from __future__ import annotations

from backend.app.config import settings

# Safety fallback so owner access does not break if OWNER_EMAIL is missing in deploy env.
DEFAULT_OWNER_EMAIL = "khan011504@gmail.com"


def get_owner_email() -> str:
    configured = (settings.OWNER_EMAIL or "").strip().lower()
    if configured:
        return configured
    return DEFAULT_OWNER_EMAIL


def is_owner_email(email: str | None) -> bool:
    owner_email = get_owner_email()
    user_email = (email or "").strip().lower()
    return bool(owner_email and user_email and user_email == owner_email)

