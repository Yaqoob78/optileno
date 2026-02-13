"""
Enhanced logging for security events.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any

from backend.analytics.collectors.events import collect_and_save_event

logger = logging.getLogger(__name__)


async def log_security_event(
    user_id: str,
    event: str,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Log security-related events.
    - rate_limit_hit
    - quota_exceeded
    - invalid_token
    - suspicious_activity
    """
    log_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "event": event,
        "source": "security",
        "metadata": metadata or {},
    }

    # Local log
    logger.warning(
        f"SECURITY_EVENT: {event} | user={user_id} | {metadata or ''}"
    )

    # Persist to analytics (non-blocking responsibility upstream)
    await collect_and_save_event(log_data)
