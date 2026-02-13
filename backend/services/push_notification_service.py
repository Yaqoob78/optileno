# backend/services/push_notification_service.py
"""
Push notification service using Firebase Cloud Messaging
"""

import logging
from typing import List, Dict, Any, Optional
import firebase_admin
from firebase_admin import credentials, messaging
import os
import json

logger = logging.getLogger(__name__)

class PushNotificationService:
    """Service for sending push notifications via Firebase"""
    
    def __init__(self):
        self.initialized = False
        self.init_firebase()
    
    def init_firebase(self):
        """Initialize Firebase app"""
        try:
            # Check if Firebase is already initialized
            if not firebase_admin._apps:
                # Try to load credentials from environment or file
                firebase_key = os.getenv('FIREBASE_CREDENTIALS')
                
                if firebase_key:
                    # Credentials as JSON string
                    if firebase_key.startswith('{'):
                        creds_dict = json.loads(firebase_key)
                    else:
                        # Path to credentials file
                        creds_dict = json.load(open(firebase_key))
                    
                    creds = credentials.Certificate(creds_dict)
                    firebase_admin.initialize_app(creds)
                    self.initialized = True
                    logger.info("✅ Firebase initialized")
                else:
                    logger.warning("⚠️ Firebase credentials not found")
        except Exception as e:
            logger.error(f"❌ Firebase initialization failed: {e}")
    
    async def send_notification(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        notification_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send push notification to device"""
        
        if not self.initialized:
            logger.warning("Firebase not initialized")
            return {"status": "failed", "reason": "Firebase not initialized"}
        
        try:
            # Build notification
            notification = messaging.Notification(title=title, body=body)
            
            # Build message
            message = messaging.Message(
                token=device_token,
                notification=notification,
                data=data or {}
            )
            
            # Send
            response = messaging.send(message)
            
            logger.info(f"📱 Push notification sent - Message ID: {response}")
            
            return {
                "status": "sent",
                "message_id": response,
                "device": device_token[:20] + "..."
            }
            
        except Exception as e:
            logger.error(f"❌ Push notification failed: {e}")
            return {
                "status": "failed",
                "reason": str(e)
            }
    
    async def send_multicast(
        self,
        device_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Send push notification to multiple devices"""
        
        if not self.initialized:
            logger.warning("Firebase not initialized")
            return {"status": "failed", "reason": "Firebase not initialized"}
        
        try:
            # Build message
            multicast_message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                tokens=device_tokens,
                data=data or {}
            )
            
            # Send
            response = messaging.send_multicast(multicast_message)
            
            logger.info(f"📱 Multicast notification sent - Success: {response.success_count}, Failed: {response.failure_count}")
            
            return {
                "status": "sent",
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "total_count": len(device_tokens)
            }
            
        except Exception as e:
            logger.error(f"❌ Multicast notification failed: {e}")
            return {
                "status": "failed",
                "reason": str(e),
                "total_count": len(device_tokens)
            }
    
    async def send_task_notification(
        self,
        device_tokens: List[str],
        task_name: str,
        action: str,  # created, updated, completed, shared
        actor_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send task-related notification"""
        
        # Build title and body based on action
        action_map = {
            "created": (f"New Task", f"New task created: {task_name}"),
            "updated": (f"Task Updated", f"{task_name} was updated"),
            "completed": (f"Task Completed", f"{task_name} was marked complete"),
            "shared": (f"Task Shared", f"{actor_name} shared '{task_name}' with you"),
        }
        
        title, body = action_map.get(action, (task_name, action))
        
        return await self.send_multicast(
            device_tokens=device_tokens,
            title=title,
            body=body,
            data={
                "type": "task",
                "action": action,
                "task_name": task_name
            }
        )
    
    async def send_collaboration_notification(
        self,
        device_tokens: List[str],
        message: str,
        collaborator_name: str,
    ) -> Dict[str, Any]:
        """Send collaboration-related notification"""
        
        return await self.send_multicast(
            device_tokens=device_tokens,
            title="Collaboration Update",
            body=message,
            data={
                "type": "collaboration",
                "collaborator": collaborator_name
            }
        )
    
    async def send_agent_notification(
        self,
        device_tokens: List[str],
        agent_response_summary: str,
    ) -> Dict[str, Any]:
        """Send AI agent notification"""
        
        return await self.send_multicast(
            device_tokens=device_tokens,
            title="AI Agent Response",
            body=agent_response_summary[:100],
            data={
                "type": "agent",
                "action": "response_ready"
            }
        )


# Singleton instance
push_service = PushNotificationService()
