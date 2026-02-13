# backend/services/notification_service.py
"""
Notification Service - Multi-channel notifications (in-app, push, email)
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum
import asyncio

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """Types of notifications"""
    TASK_CREATED = "task_created"
    TASK_COMPLETED = "task_completed"
    DEEP_WORK_REMINDER = "deep_work_reminder"
    DEEP_WORK_COMPLETED = "deep_work_completed"
    ACHIEVEMENT = "achievement"
    GOAL_MILESTONE = "goal_milestone"
    INSIGHT_GENERATED = "insight_generated"
    TASK_SHARED = "task_shared"
    COLLABORATION_UPDATE = "collaboration_update"
    REMINDER = "reminder"
    SYSTEM_ALERT = "system_alert"


class NotificationChannel(str, Enum):
    """Delivery channels for notifications"""
    IN_APP = "in_app"
    PUSH = "push"
    EMAIL = "email"
    BOTH = "both"


class NotificationPriority(str, Enum):
    """Notification priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Notification:
    """Represents a single notification"""
    
    def __init__(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        channels: List[NotificationChannel] = None,
        metadata: Optional[Dict[str, Any]] = None,
        action_url: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ):
        self.user_id = user_id
        self.notification_type = notification_type
        self.title = title
        self.message = message
        self.priority = priority
        self.channels = channels or [NotificationChannel.IN_APP]
        self.metadata = metadata or {}
        self.action_url = action_url
        self.created_at = datetime.utcnow()
        self.expires_at = expires_at
        self.read = False
        self.read_at: Optional[datetime] = None
        self.delivered_channels: List[NotificationChannel] = []
    
    def mark_as_read(self):
        """Mark notification as read"""
        self.read = True
        self.read_at = datetime.utcnow()
    
    def mark_delivered(self, channel: NotificationChannel):
        """Mark notification as delivered on a channel"""
        if channel not in self.delivered_channels:
            self.delivered_channels.append(channel)
    
    def is_expired(self) -> bool:
        """Check if notification has expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "type": self.notification_type.value,
            "title": self.title,
            "message": self.message,
            "priority": self.priority.value,
            "channels": [c.value for c in self.channels],
            "read": self.read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "action_url": self.action_url,
            "metadata": self.metadata
        }


class NotificationPreferences:
    """User notification preferences"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.enabled = True
        self.quiet_hours_start: Optional[str] = None  # "22:00"
        self.quiet_hours_end: Optional[str] = None    # "08:00"
        
        # Channel preferences
        self.channels = {
            NotificationType.TASK_CREATED: [NotificationChannel.IN_APP],
            NotificationType.TASK_COMPLETED: [NotificationChannel.IN_APP],
            NotificationType.DEEP_WORK_REMINDER: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
            NotificationType.DEEP_WORK_COMPLETED: [NotificationChannel.IN_APP],
            NotificationType.ACHIEVEMENT: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
            NotificationType.GOAL_MILESTONE: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
            NotificationType.INSIGHT_GENERATED: [NotificationChannel.IN_APP],
            NotificationType.TASK_SHARED: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
            NotificationType.COLLABORATION_UPDATE: [NotificationChannel.PUSH],
            NotificationType.REMINDER: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
            NotificationType.SYSTEM_ALERT: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
        }
    
    def get_channels_for_type(self, notification_type: NotificationType) -> List[NotificationChannel]:
        """Get preferred channels for a notification type"""
        if not self.enabled:
            return []
        return self.channels.get(notification_type, [NotificationChannel.IN_APP])
    
    def is_in_quiet_hours(self) -> bool:
        """Check if current time is in quiet hours"""
        if not self.quiet_hours_start or not self.quiet_hours_end:
            return False
        
        current_time = datetime.utcnow().time()
        start = datetime.strptime(self.quiet_hours_start, "%H:%M").time()
        end = datetime.strptime(self.quiet_hours_end, "%H:%M").time()
        
        if start < end:
            return start <= current_time < end
        else:
            return current_time >= start or current_time < end
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "enabled": self.enabled,
            "quiet_hours": {
                "start": self.quiet_hours_start,
                "end": self.quiet_hours_end
            },
            "channels": {
                k.value: [c.value for c in v] for k, v in self.channels.items()
            }
        }


class NotificationService:
    """
    Main notification service
    Handles creation, storage, and delivery of notifications
    """
    
    def __init__(self):
        self.in_memory_notifications: Dict[int, List[Notification]] = {}
        self.preferences: Dict[int, NotificationPreferences] = {}
        self.delivery_handlers = {
            NotificationChannel.IN_APP: self._deliver_in_app,
            NotificationChannel.PUSH: self._deliver_push,
            NotificationChannel.EMAIL: self._deliver_email,
        }
    
    async def send_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        metadata: Optional[Dict[str, Any]] = None,
        action_url: Optional[str] = None
    ) -> Notification:
        """
        Send a notification to a user
        
        Respects user preferences and quiet hours
        """
        # Get user preferences
        prefs = self.preferences.get(
            user_id,
            NotificationPreferences(user_id)
        )
        
        # Check quiet hours for non-urgent notifications
        if prefs.is_in_quiet_hours() and priority != NotificationPriority.URGENT:
            logger.info(f"🤫 Notification queued for quiet hours (user {user_id})")
            channels = [NotificationChannel.IN_APP]  # Only in-app during quiet hours
        else:
            channels = prefs.get_channels_for_type(notification_type)
        
        # Create notification
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            channels=channels,
            metadata=metadata,
            action_url=action_url
        )
        
        # Store notification
        if user_id not in self.in_memory_notifications:
            self.in_memory_notifications[user_id] = []
        self.in_memory_notifications[user_id].append(notification)
        
        # Deliver through channels
        await self._deliver_notification(notification)
        
        logger.info(f"📢 Notification sent to user {user_id}: {title}")
        return notification
    
    async def _deliver_notification(self, notification: Notification):
        """Deliver notification through specified channels"""
        tasks = []
        
        for channel in notification.channels:
            handler = self.delivery_handlers.get(channel)
            if handler:
                tasks.append(handler(notification))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _deliver_in_app(self, notification: Notification):
        """Deliver in-app notification (stored in memory/DB)"""
        notification.mark_delivered(NotificationChannel.IN_APP)
        logger.info(f"📱 In-app notification delivered")
    
    async def _deliver_push(self, notification: Notification):
        """Send push notification"""
        try:
            from backend.services.push_notification_service import push_service
            
            # Get user's device tokens (would be fetched from DB in production)
            device_tokens = []  # TODO: Fetch from user preferences
            
            if device_tokens:
                result = await push_service.send_notification(
                    device_token=device_tokens[0] if device_tokens else "",
                    title=notification.title,
                    body=notification.message,
                    data=notification.metadata,
                    notification_type=notification.notification_type.value
                )
                logger.info(f"🔔 Push notification result: {result}")
            
            notification.mark_delivered(NotificationChannel.PUSH)
        except Exception as e:
            logger.error(f"Failed to send push: {e}")
    
    async def _deliver_email(self, notification: Notification):
        """Send email notification"""
        try:
            from backend.services.email_service import email_service
            
            # Get user email (would be fetched from DB in production)
            user_email = notification.metadata.get("user_email", "")
            
            if user_email:
                result = await email_service.send_notification_email(
                    user_email=user_email,
                    user_name=notification.metadata.get("user_name", "User"),
                    notification_title=notification.title,
                    notification_message=notification.message,
                    action_url=notification.action_url
                )
                logger.info(f"📧 Email notification result: {result}")
            
            notification.mark_delivered(NotificationChannel.EMAIL)
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
    
    def get_user_notifications(
        self,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Notification]:
        """Get user's notifications"""
        notifications = self.in_memory_notifications.get(user_id, [])
        
        if unread_only:
            notifications = [n for n in notifications if not n.read]
        
        # Remove expired notifications
        notifications = [n for n in notifications if not n.is_expired()]
        
        # Sort by creation date (newest first)
        notifications.sort(key=lambda x: x.created_at, reverse=True)
        
        return notifications[:limit]
    
    def mark_as_read(self, user_id: int, notification_index: int) -> bool:
        """Mark a notification as read"""
        notifications = self.in_memory_notifications.get(user_id, [])
        if 0 <= notification_index < len(notifications):
            notifications[notification_index].mark_as_read()
            return True
        return False
    
    def update_preferences(
        self,
        user_id: int,
        preferences: NotificationPreferences
    ):
        """Update user notification preferences"""
        self.preferences[user_id] = preferences
        logger.info(f"✅ Preferences updated for user {user_id}")
    
    async def send_achievement_notification(
        self,
        user_id: int,
        achievement_title: str,
        description: str,
        reward_points: int
    ):
        """Send achievement notification"""
        await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.ACHIEVEMENT,
            title=f"🏆 Achievement Unlocked: {achievement_title}",
            message=description,
            priority=NotificationPriority.HIGH,
            metadata={
                "achievement": achievement_title,
                "reward_points": reward_points
            }
        )
    
    async def send_goal_milestone_notification(
        self,
        user_id: int,
        goal_name: str,
        progress_percent: float
    ):
        """Send goal milestone notification"""
        await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.GOAL_MILESTONE,
            title=f"🎯 Goal Progress: {goal_name}",
            message=f"You're {progress_percent}% of the way to your goal!",
            priority=NotificationPriority.HIGH,
            metadata={
                "goal": goal_name,
                "progress": progress_percent
            }
        )
    
    async def send_deep_work_reminder(
        self,
        user_id: int,
        task_name: str,
        scheduled_time: str
    ):
        """Send deep work session reminder"""
        await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.DEEP_WORK_REMINDER,
            title="⏰ Deep Work Session Reminder",
            message=f"Your deep work session for '{task_name}' starts at {scheduled_time}",
            priority=NotificationPriority.HIGH,
            metadata={
                "task": task_name,
                "scheduled_time": scheduled_time
            }
        )


# Global notification service instance
notification_service = NotificationService()
