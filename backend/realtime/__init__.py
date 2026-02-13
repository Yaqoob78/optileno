# backend/realtime/__init__.py
"""
Real-time updates module for Concierge AI
"""

from .socket_manager import (
    sio,
    broadcast_task_created,
    broadcast_task_updated,
    broadcast_task_deleted,
    broadcast_deep_work_started,
    broadcast_deep_work_completed,
    broadcast_analytics_update,
    broadcast_insight_generated,
    broadcast_notification,
    broadcast_habit_completed,
    broadcast_plan_generated,
    broadcast_message_received,
    broadcast_conversation_updated,
    # Phase 3 broadcast functions
    broadcast_task_shared,
    broadcast_comment_added,
    broadcast_collaboration_session_started,
    broadcast_collaboration_update,
    broadcast_notification_received,
    broadcast_agent_conversation_update,
    broadcast_agent_thinking,
    create_socketio_app,
    get_connected_users_count,
    get_connected_sessions_count,
    is_user_online,
)

__all__ = [
    'sio',
    'broadcast_task_created',
    'broadcast_task_updated',
    'broadcast_task_deleted',
    'broadcast_deep_work_started',
    'broadcast_deep_work_completed',
    'broadcast_analytics_update',
    'broadcast_insight_generated',
    'broadcast_notification',
    'broadcast_habit_completed',
    'broadcast_plan_generated',
    'broadcast_message_received',
    'broadcast_conversation_updated',
    # Phase 3 broadcast functions
    'broadcast_task_shared',
    'broadcast_comment_added',
    'broadcast_collaboration_session_started',
    'broadcast_collaboration_update',
    'broadcast_notification_received',
    'broadcast_agent_conversation_update',
    'broadcast_agent_thinking',
    'create_socketio_app',
    'get_connected_users_count',
    'get_connected_sessions_count',
    'is_user_online',
]
