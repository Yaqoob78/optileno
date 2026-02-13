# backend/db/session.py
"""
Shim to redirect imports to the canonical database module.
Prevents duplicate engines/declarative bases.
"""
from backend.db.database import (
    engine,
    AsyncSessionLocal as async_session,
    Base,
    get_db
)

__all__ = ["engine", "async_session", "Base", "get_db"]