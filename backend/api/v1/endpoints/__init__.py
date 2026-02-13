# This file makes the endpoints directory a Python package
# It also exports all routers for easy importing

from .auth import router as auth_router
from .chat import router as chat_router
from .plans import router as plans_router
from .analytics import router as analytics_router
from .system import router as system_router

__all__ = [
    "auth_router",
    "chat_router",
    "plans_router",
    "analytics_router",
    "system_router",
]