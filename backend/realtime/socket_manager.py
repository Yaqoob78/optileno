# backend/realtime/socket_manager.py
"""
Enterprise Real-time Socket.IO Manager for Optileno SaaS.

Features:
- Redis adapter for multi-instance horizontal scaling
- Connection health monitoring with heartbeat
- Automatic reconnection with exponential backoff
- Message queuing for high-volume scenarios (5,000+ users)
- Fan-out optimization for broadcasting
- Connection metrics and monitoring
"""

import logging
import asyncio
import time
from typing import Dict, List, Set, Optional, Any
from http.cookies import SimpleCookie
from socketio import AsyncServer, ASGIApp
from sqlalchemy import select
from jose import JWTError
import json
from datetime import datetime, date
from collections import deque

from backend.app.config import settings
from backend.auth.auth_utils import decode_token
from backend.db.database import AsyncSessionLocal
from backend.db.models import User

logger = logging.getLogger(__name__)


# ==================================================
# WebSocket Connection Metrics
# ==================================================
class WebSocketMetrics:
    """Track WebSocket connection metrics."""
    
    def __init__(self):
        self.total_connections = 0
        self.current_connections = 0
        self.peak_connections = 0
        self.rejected_connections = 0
        self.total_messages_sent = 0
        self.total_messages_received = 0
        self.failed_broadcasts = 0
        self.reconnections = 0
        self.queue_dropped_messages = 0
        self.avg_message_latency_ms = 0.0
        self._latencies: deque = deque(maxlen=1000)
        self.last_heartbeat = None
    
    def record_connection(self):
        self.total_connections += 1
        self.current_connections += 1
        self.peak_connections = max(self.peak_connections, self.current_connections)
    
    def record_disconnection(self):
        self.current_connections = max(0, self.current_connections - 1)

    def record_rejected_connection(self):
        self.rejected_connections += 1
    
    def record_message_sent(self, latency_ms: float = 0):
        self.total_messages_sent += 1
        if latency_ms > 0:
            self._latencies.append(latency_ms)
            self.avg_message_latency_ms = sum(self._latencies) / len(self._latencies)
    
    def record_message_received(self):
        self.total_messages_received += 1
    
    def record_failed_broadcast(self):
        self.failed_broadcasts += 1

    def record_queue_drop(self):
        self.queue_dropped_messages += 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_connections": self.total_connections,
            "current_connections": self.current_connections,
            "peak_connections": self.peak_connections,
            "rejected_connections": self.rejected_connections,
            "total_messages_sent": self.total_messages_sent,
            "total_messages_received": self.total_messages_received,
            "failed_broadcasts": self.failed_broadcasts,
            "reconnections": self.reconnections,
            "queue_dropped_messages": self.queue_dropped_messages,
            "avg_message_latency_ms": round(self.avg_message_latency_ms, 2),
            "last_heartbeat": self.last_heartbeat,
        }

ws_metrics = WebSocketMetrics()


# ==================================================
# Message Queue for High-Volume Broadcasting
# ==================================================
class MessageQueue:
    """
    Message queue for handling high-volume broadcasts.
    Batches messages to reduce overhead.
    """
    
    def __init__(self, max_size: int = None):
        self.max_size = max_size or settings.WEBSOCKET_MESSAGE_QUEUE_SIZE
        self.queue: deque = deque(maxlen=self.max_size)
        self._processing = False
    
    def enqueue(self, event: str, data: Dict[str, Any], room: str):
        if len(self.queue) >= self.max_size:
            # Drop oldest and count it so queue pressure is observable.
            self.queue.popleft()
            ws_metrics.record_queue_drop()
        self.queue.append({
            "event": event,
            "data": data,
            "room": room,
            "timestamp": time.time()
        })
    
    async def process_batch(self, sio_instance, batch_size: Optional[int] = None):
        """Process a batch of queued messages."""
        if self._processing:
            return 0

        effective_batch_size = batch_size or settings.WEBSOCKET_QUEUE_BATCH_SIZE
        
        self._processing = True
        processed = 0
        
        try:
            while self.queue and processed < effective_batch_size:
                msg = self.queue.popleft()
                try:
                    await sio_instance.emit(msg["event"], msg["data"], room=msg["room"])
                    ws_metrics.record_message_sent((time.time() - msg["timestamp"]) * 1000)
                    processed += 1
                except Exception as e:
                    logger.warning(f"[WS] Failed to send queued message: {e}")
                    ws_metrics.record_failed_broadcast()
        finally:
            self._processing = False
        
        return processed

message_queue = MessageQueue()
_queue_processor_started = False


# ==================================================
# Redis Adapter Setup
# ==================================================
def create_socket_server() -> AsyncServer:
    """
    Create Socket.IO server with optional Redis adapter for horizontal scaling.
    """
    # Try to configure Redis adapter for multi-instance support
    client_manager = None
    
    if settings.REDIS_URL and settings.ENVIRONMENT == "production":
        try:
            from socketio import AsyncRedisManager
            client_manager = AsyncRedisManager(settings.REDIS_URL)
            logger.info("[WS] Redis adapter configured for horizontal scaling")
        except ImportError:
            logger.warning("[WS] socketio-redis not available, using in-memory manager")
        except Exception as e:
            logger.warning(f"[WS] Failed to configure Redis adapter: {e}")
    
    server = AsyncServer(
        async_mode='asgi',
        cors_allowed_origins=settings.CORS_ORIGINS,
        cors_credentials=True,
        logger=settings.DEBUG,
        engineio_logger=settings.DEBUG,
        ping_timeout=settings.WEBSOCKET_PING_TIMEOUT,
        ping_interval=settings.WEBSOCKET_PING_INTERVAL,
        max_http_buffer_size=1_000_000,  # 1MB max message size
        allow_upgrades=True,
        transports=['websocket', 'polling'],
        client_manager=client_manager,
    )
    
    return server


# Global socket.io instance
sio = create_socket_server()

# Track connected users (in-memory for single instance, Redis-backed for cluster)
connected_users: Dict[str, Set[str]] = {}  # user_id -> set of session_ids
user_sessions: Dict[str, str] = {}  # session_id -> user_id
session_metadata: Dict[str, Dict[str, Any]] = {}  # session_id -> metadata
active_socket_sids: Set[str] = set()  # includes unauthenticated and authenticated sockets

# Canonical event names plus one-release legacy aliases.
EVENT_ALIASES: Dict[str, List[str]] = {
    "analytics:update": ["analytics:updated"],
    "analytics:focus:updated": ["focus_score_updated"],
    "notification:new": ["notification:received"],
}


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _to_json_safe(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(json.dumps(data, default=_json_default))
    except Exception:
        return data


def _get_cookie_token(environ: dict) -> Optional[str]:
    cookie_header = environ.get("HTTP_COOKIE") or ""
    cookies = SimpleCookie()
    cookies.load(cookie_header)
    if "access_token" in cookies:
        return cookies["access_token"].value
    return None


async def _get_user_from_token(token: str) -> Optional[User]:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = payload.get("user_id")
        if not user_id:
            return None
    except JWTError:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            return None
        return user


def _register_transport_connection(sid: str) -> None:
    """Track raw socket connection count, including unauthenticated clients."""
    if sid in active_socket_sids:
        return
    active_socket_sids.add(sid)
    ws_metrics.record_connection()


def _unregister_transport_connection(sid: str) -> None:
    """Track raw socket disconnection count."""
    if sid not in active_socket_sids:
        return
    active_socket_sids.discard(sid)
    ws_metrics.record_disconnection()


async def _register_session(sid: str, user_id: int, metadata: Dict[str, Any] = None) -> None:
    """Register a new user session with metadata."""
    user_sessions[sid] = str(user_id)
    
    if str(user_id) not in connected_users:
        connected_users[str(user_id)] = set()
    connected_users[str(user_id)].add(sid)
    
    # Store session metadata
    session_metadata[sid] = {
        "user_id": user_id,
        "connected_at": datetime.utcnow().isoformat(),
        "last_activity": datetime.utcnow().isoformat(),
        **(metadata or {})
    }
    
    await sio.enter_room(sid, f'user_{user_id}')


async def _unregister_session(sid: str) -> Optional[str]:
    """Unregister a session and return the user_id."""
    user_id = user_sessions.pop(sid, None)
    session_metadata.pop(sid, None)
    
    if user_id and user_id in connected_users:
        connected_users[user_id].discard(sid)
        if not connected_users[user_id]:
            del connected_users[user_id]
    
    return user_id


# ==========================================
# CONNECTION HANDLERS
# ==========================================

@sio.event
async def connect(sid: str, environ: dict):
    """Handle client connection with authentication."""
    if len(active_socket_sids) >= settings.WEBSOCKET_MAX_CONNECTIONS:
        logger.warning(
            f"[WS] Max connections reached: {len(active_socket_sids)}/"
            f"{settings.WEBSOCKET_MAX_CONNECTIONS}"
        )
        ws_metrics.record_rejected_connection()
        return False

    _register_transport_connection(sid)
    logger.info(f"Client {sid} connecting...")
    ws_metrics.record_message_received()

    # Attempt cookie-based authentication on connect
    try:
        token = _get_cookie_token(environ)
        if token:
            user = await _get_user_from_token(token)
            if user:
                # Check concurrent session limit
                current_sessions = len(connected_users.get(str(user.id), set()))
                if current_sessions >= settings.MAX_CONCURRENT_SESSIONS and current_sessions > 0:
                    logger.warning(f"[WS] User {user.id} exceeded max sessions ({settings.MAX_CONCURRENT_SESSIONS})")
                    # Disconnect oldest session (actual transport disconnect).
                    user_session_sids = list(connected_users.get(str(user.id), set()))
                    if user_session_sids:
                        oldest_sid = min(
                            user_session_sids,
                            key=lambda session_id: session_metadata.get(session_id, {}).get("connected_at", ""),
                        )
                        await sio.emit('session:expired', {'reason': 'new_session'}, to=oldest_sid)
                        await sio.disconnect(oldest_sid)
                
                await _register_session(sid, user.id, {
                    "user_agent": environ.get("HTTP_USER_AGENT", "unknown")
                })
                await sio.emit('authenticated', {
                    'status': 'connected',
                    'user_id': user.id,
                    'session_id': sid
                }, to=sid)
                logger.info(f"User {user.id} connected (sid: {sid})")
    except Exception as exc:
        logger.warning(f"Socket auth on connect failed: {exc}")

    return True


@sio.event
async def disconnect(sid: str):
    """Handle client disconnection."""
    user_id = await _unregister_session(sid)
    _unregister_transport_connection(sid)
    if user_id:
        logger.info(f"User {user_id} disconnected (sid: {sid})")
    else:
        logger.info(f"Client {sid} disconnected (unauthenticated)")


@sio.event
async def authenticate(sid: str, data: dict):
    """
    Authenticate user and join their room.
    Client sends: {user_id: "123", token: "jwt_token"}
    """
    ws_metrics.record_message_received()
    
    try:
        # Already authenticated via cookie
        if sid in user_sessions:
            await sio.emit('authenticated', {
                'status': 'connected',
                'user_id': user_sessions[sid],
                'session_id': sid
            }, to=sid)
            return True

        token = data.get('token')
        if not token:
            await sio.emit('error', {'message': 'Missing token'}, to=sid)
            return False

        user = await _get_user_from_token(token)
        if not user:
            await sio.emit('error', {'message': 'Invalid token'}, to=sid)
            return False

        token_user_id = str(user.id)
        provided_user_id = data.get('user_id')
        if provided_user_id and str(provided_user_id) != token_user_id:
            await sio.emit('error', {'message': 'User mismatch'}, to=sid)
            return False

        await _register_session(sid, user.id)
        logger.info(f"User {user.id} authenticated (sid: {sid})")
        await sio.emit('authenticated', {
            'status': 'connected',
            'user_id': user.id,
            'session_id': sid
        }, to=sid)
        return True
        
    except Exception as e:
        logger.error(f"Auth error: {e}")
        await sio.emit('error', {'message': 'Authentication failed'}, to=sid)
        return False


@sio.event
async def heartbeat(sid: str, data: dict):
    """Handle client heartbeat for connection health."""
    ws_metrics.record_message_received()
    
    if sid in session_metadata:
        session_metadata[sid]["last_activity"] = datetime.utcnow().isoformat()
    
    ws_metrics.last_heartbeat = datetime.utcnow().isoformat()
    
    await sio.emit('heartbeat_ack', {
        'timestamp': datetime.utcnow().isoformat(),
        'server_time': time.time()
    }, to=sid)


# ==========================================
# OPTIMIZED BROADCAST FUNCTIONS
# ==========================================

async def _safe_emit(event: str, data: Dict[str, Any], room: str, use_queue: bool = False):
    """
    Safe emit with error handling and optional queuing.
    For high-volume scenarios, messages can be queued for batch processing.
    """
    start_time = time.time()
    
    payload = _to_json_safe(data)

    try:
        should_queue = use_queue or ws_metrics.current_connections > settings.WEBSOCKET_QUEUE_THRESHOLD_CONNECTIONS
        if should_queue:
            # Queue for batch processing under heavy load
            message_queue.enqueue(event, payload, room)
            for alias in EVENT_ALIASES.get(event, []):
                message_queue.enqueue(alias, payload, room)
        else:
            await sio.emit(event, payload, room=room)
            for alias in EVENT_ALIASES.get(event, []):
                await sio.emit(alias, payload, room=room)
            ws_metrics.record_message_sent((time.time() - start_time) * 1000)
    except Exception as e:
        ws_metrics.record_failed_broadcast()
        logger.warning(f"[WS] Broadcast failed for {event} to {room}: {e}")


async def broadcast_task_created(user_id: int, task: Dict[str, Any]):
    """Broadcast when task is created"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:task:created',
        {
            'event': 'task_created',
            'task': task,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📝 Task created broadcasted to {room}")


async def broadcast_task_updated(user_id: int, task: Dict[str, Any]):
    """Broadcast when task is updated"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:task:updated',
        {
            'event': 'task_updated',
            'task': task,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"✏️ Task updated broadcasted to {room}")


async def broadcast_task_deleted(user_id: int, task_id: str):
    """Broadcast when task is deleted"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:task:deleted',
        {
            'event': 'task_deleted',
            'task_id': task_id,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🗑️ Task deleted broadcasted to {room}")


async def broadcast_goal_created(user_id: int, goal: Dict[str, Any]):
    """Broadcast when goal is created"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:goal:created',
        {
            'event': 'goal_created',
            'goal': goal,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🎯 Goal created broadcasted to {room}")


async def broadcast_goal_updated(user_id: int, goal: Dict[str, Any]):
    """Broadcast when goal is updated"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:goal:updated',
        {
            'event': 'goal_updated',
            'goal': goal,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"✏️ Goal updated broadcasted to {room}")


async def broadcast_goal_progress_changed(user_id: int, goal_data: Dict[str, Any]):
    """Broadcast when goal progress changes"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:goal:progress_changed',
        {
            'event': 'goal_progress_changed',
            'goal_id': goal_data.get('goal_id'),
            'progress': goal_data.get('progress'),
            'previous_progress': goal_data.get('previous_progress'),
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📈 Goal progress broadcasted to {room}")


async def broadcast_deep_work_started(user_id: int, session: Dict[str, Any]):
    """Broadcast when deep work session starts"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:deepwork:started',
        {
            'event': 'deep_work_started',
            'session': session,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🎯 Deep Work started broadcasted to {room}")


async def broadcast_deep_work_completed(user_id: int, session: Dict[str, Any]):
    """Broadcast when deep work session completes"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:deepwork:completed',
        {
            'event': 'deep_work_completed',
            'session': session,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"✨ Deep Work completed broadcasted to {room}")


async def broadcast_analytics_update(user_id: int, metrics: Dict[str, Any]):
    """Broadcast real-time analytics update"""
    room = f'user_{user_id}'
    await _safe_emit(
        'analytics:update',
        {
            'event': 'analytics_update',
            'metrics': metrics,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📊 Analytics updated broadcasted to {room}")


async def broadcast_insight_generated(user_id: int, insight: Dict[str, Any]):
    """Broadcast when AI generates new insight"""
    room = f'user_{user_id}'
    await _safe_emit(
        'analytics:insight',
        {
            'event': 'insight_generated',
            'insight': insight,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"💡 Insight generated broadcasted to {room}")


async def broadcast_focus_score_updated(user_id: int, score_data: Dict[str, Any]):
    """Broadcast when focus score is recalculated"""
    room = f'user_{user_id}'
    await _safe_emit(
        'analytics:focus:updated',
        {
            'event': 'focus_score_updated',
            'type': 'focus_score_updated',
            'score': score_data.get('score', 0),
            'breakdown': score_data.get('breakdown', {}),
            'color': score_data.get('color', {}),
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📊 Focus score updated broadcasted to {room}")


async def broadcast_notification(user_id: int, notification: Dict[str, Any]):
    """Broadcast notification to user"""
    room = f'user_{user_id}'
    await _safe_emit(
        'notification:new',
        {
            'event': 'notification',
            'notification': notification,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🔔 Notification broadcasted to {room}")


async def broadcast_habit_created(user_id: int, habit: Dict[str, Any]):
    """Broadcast when habit is created"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:habit:created',
        {
            'event': 'habit_created',
            'habit': habit,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🔄 Habit created broadcasted to {room}")


async def broadcast_habit_completed(user_id: int, habit: Dict[str, Any]):
    """Broadcast when habit is completed"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:habit:completed',
        {
            'event': 'habit_completed',
            'habit': habit,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🏆 Habit completed broadcasted to {room}")


async def broadcast_plan_generated(user_id: int, plan: Dict[str, Any]):
    """Broadcast when AI generates a new plan"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:plan:generated',
        {
            'event': 'plan_generated',
            'plan': plan,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📅 Plan generated broadcasted to {room}")


async def broadcast_message_received(user_id: int, message: Dict[str, Any]):
    """Broadcast when new message received"""
    room = f'user_{user_id}'
    await _safe_emit(
        'chat:message:received',
        {
            'event': 'message_received',
            'message': {
                'user_message': message.get('user_message'),
                'ai_response': message.get('ai_response'),
                'session_id': message.get('session_id'),
                'intent': message.get('intent'),
                'provider': message.get('provider'),
                'model': message.get('model'),
                'message_count': message.get('message_count'),
                'timestamp': message.get('timestamp')
            },
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"💬 Message received broadcasted to {room}")


async def broadcast_conversation_updated(user_id: int, conversation: Dict[str, Any]):
    """Broadcast when conversation is updated"""
    room = f'user_{user_id}'
    await _safe_emit(
        'chat:conversation:updated',
        {
            'event': 'conversation_updated',
            'conversation': conversation,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📝 Conversation updated broadcasted to {room}")


# ==========================================
# ENHANCED REAL-TIME EVENTS
# ==========================================

async def broadcast_goal_achievement(user_id: int, achievement: Dict[str, Any]):
    """Broadcast when a goal milestone is achieved"""
    room = f'user_{user_id}'
    await _safe_emit(
        'planner:goal:achievement',
        {
            'event': 'goal_achievement',
            'achievement': achievement,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🎉 Goal achievement broadcasted to {room}")


async def broadcast_daily_summary(user_id: int, summary: Dict[str, Any]):
    """Broadcast daily summary at end of day"""
    room = f'user_{user_id}'
    await _safe_emit(
        'analytics:daily:summary',
        {
            'event': 'daily_summary',
            'summary': summary,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📊 Daily summary broadcasted to {room}")


async def broadcast_weekly_insights(user_id: int, insights: Dict[str, Any]):
    """Broadcast weekly insights and trends"""
    room = f'user_{user_id}'
    await _safe_emit(
        'analytics:weekly:insights',
        {
            'event': 'weekly_insights',
            'insights': insights,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"📈 Weekly insights broadcasted to {room}")


async def broadcast_system_alert(user_id: int, alert: Dict[str, Any]):
    """Broadcast system alerts and notifications"""
    room = f'user_{user_id}'
    await _safe_emit(
        'system:alert',
        {
            'event': 'system_alert',
            'alert': alert,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🚨 System alert broadcasted to {room}")


async def broadcast_presence_update(user_id: int, presence_data: Dict[str, Any]):
    """Broadcast user presence status"""
    room = f'user_{user_id}'
    await _safe_emit(
        'presence:updated',
        {
            'event': 'presence_updated',
            'data': presence_data,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"👤 Presence updated broadcasted to {room}")


async def broadcast_collaboration_invite(user_id: int, invite_data: Dict[str, Any]):
    """Broadcast collaboration invites"""
    room = f'user_{user_id}'
    await _safe_emit(
        'collaboration:invite',
        {
            'event': 'collaboration_invite',
            'invite': invite_data,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🤝 Collaboration invite broadcasted to {room}")


# ==========================================
# COLLABORATION & NOTIFICATIONS
# ==========================================

async def broadcast_task_shared(owner_id: int, shared_with_id: int, task: Dict[str, Any]):
    """Broadcast when task is shared"""
    room = f'user_{shared_with_id}'
    await _safe_emit(
        'collaboration:task:shared',
        {
            'event': 'task_shared',
            'task': task,
            'shared_by_id': owner_id,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🔗 Task shared broadcasted to {room}")


async def broadcast_comment_added(user_id: int, task_id: str, comment: Dict[str, Any]):
    """Broadcast when comment is added to shared task"""
    room = f'user_{user_id}'
    await _safe_emit(
        'collaboration:comment:added',
        {
            'event': 'comment_added',
            'task_id': task_id,
            'comment': comment,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"💬 Comment added broadcasted to {room}")


async def broadcast_collaboration_session_started(user_id: int, session_data: Dict[str, Any]):
    """Broadcast when collaboration session starts"""
    room = f'user_{user_id}'
    await _safe_emit(
        'collaboration:session:started',
        {
            'event': 'session_started',
            'session': session_data,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"👥 Collaboration session started broadcasted to {room}")


async def broadcast_collaboration_update(user_id: int, session_id: str, change: Dict[str, Any]):
    """Broadcast real-time update in collaboration session"""
    room = f'user_{user_id}'
    await _safe_emit(
        'collaboration:update',
        {
            'event': 'collaboration_update',
            'session_id': session_id,
            'change': change,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🔄 Collaboration update broadcasted to {room}")


async def broadcast_notification_received(user_id: int, notification: Dict[str, Any]):
    """Broadcast when notification is sent"""
    room = f'user_{user_id}'
    await _safe_emit(
        'notification:new',
        {
            'event': 'notification_received',
            'notification': notification,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🔔 Notification broadcasted to {room}")


async def broadcast_agent_conversation_update(user_id: int, conversation_id: str, update: Dict[str, Any]):
    """Broadcast when AI agent conversation is updated"""
    room = f'user_{user_id}'
    await _safe_emit(
        'agent:conversation:updated',
        {
            'event': 'agent_conversation_updated',
            'conversation_id': conversation_id,
            'update': update,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🤖 Agent conversation update broadcasted to {room}")


async def broadcast_agent_thinking(user_id: int, conversation_id: str, step: Dict[str, Any]):
    """Broadcast agent thinking/processing status"""
    room = f'user_{user_id}'
    await _safe_emit(
        'agent:thinking',
        {
            'event': 'agent_thinking',
            'conversation_id': conversation_id,
            'step': step,
            'timestamp': datetime.utcnow().isoformat()
        },
        room=room
    )
    logger.debug(f"🧠 Agent thinking broadcasted to {room}")


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def get_connected_users_count() -> int:
    """Get total number of connected users"""
    return len(connected_users)


def get_connected_sessions_count() -> int:
    """Get total number of connected sessions"""
    return len(active_socket_sids)


async def get_user_connected_clients(user_id: int) -> List[str]:
    """Get all connected client session IDs for a user"""
    return list(connected_users.get(str(user_id), set()))


async def is_user_online(user_id: int) -> bool:
    """Check if user has any active connections"""
    return str(user_id) in connected_users and bool(connected_users[str(user_id)])


def get_websocket_metrics() -> Dict[str, Any]:
    """Get WebSocket connection metrics."""
    return {
        **ws_metrics.to_dict(),
        "connected_users": len(connected_users),
        "active_sessions": len(active_socket_sids),
        "authenticated_sessions": len(user_sessions),
        "queue_size": len(message_queue.queue),
        "config": {
            "ping_interval": settings.WEBSOCKET_PING_INTERVAL,
            "ping_timeout": settings.WEBSOCKET_PING_TIMEOUT,
            "max_connections": settings.WEBSOCKET_MAX_CONNECTIONS,
            "message_queue_size": settings.WEBSOCKET_MESSAGE_QUEUE_SIZE,
            "queue_batch_size": settings.WEBSOCKET_QUEUE_BATCH_SIZE,
            "queue_process_interval_ms": settings.WEBSOCKET_QUEUE_PROCESS_INTERVAL_MS,
            "queue_threshold_connections": settings.WEBSOCKET_QUEUE_THRESHOLD_CONNECTIONS,
        }
    }


async def get_connection_health() -> Dict[str, Any]:
    """Get WebSocket connection health status."""
    return {
        "status": "healthy" if ws_metrics.current_connections < settings.WEBSOCKET_MAX_CONNECTIONS else "degraded",
        "current_connections": ws_metrics.current_connections,
        "max_connections": settings.WEBSOCKET_MAX_CONNECTIONS,
        "utilization_percent": round(ws_metrics.current_connections / settings.WEBSOCKET_MAX_CONNECTIONS * 100, 2),
        "last_heartbeat": ws_metrics.last_heartbeat,
        "failed_broadcasts": ws_metrics.failed_broadcasts,
    }


# ==========================================
# BACKGROUND TASKS
# ==========================================

async def process_message_queue():
    """Background task to process queued messages."""
    sleep_seconds = max(0.01, settings.WEBSOCKET_QUEUE_PROCESS_INTERVAL_MS / 1000.0)
    while True:
        try:
            if message_queue.queue:
                processed = 0
                for _ in range(5):
                    batch_processed = await message_queue.process_batch(
                        sio,
                        batch_size=settings.WEBSOCKET_QUEUE_BATCH_SIZE,
                    )
                    processed += batch_processed
                    if batch_processed < settings.WEBSOCKET_QUEUE_BATCH_SIZE:
                        break
                if processed > 0:
                    logger.debug(f"[WS] Processed {processed} queued messages")
        except Exception as e:
            logger.error(f"[WS] Error processing message queue: {e}")
        await asyncio.sleep(sleep_seconds)


# Create ASGI app wrapper
def create_socketio_app(app):
    """Create Socket.IO ASGI wrapper for FastAPI app"""
    global _queue_processor_started
    if not _queue_processor_started:
        sio.start_background_task(process_message_queue)
        _queue_processor_started = True
        logger.info("[WS] Message queue processor started")

    return ASGIApp(
        sio, 
        app, 
        socketio_path='socket.io'
    )
