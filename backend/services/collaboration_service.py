# backend/services/collaboration_service.py
"""
Collaboration Service - Task sharing, permissions, real-time collaboration
"""

import logging
from typing import List, Dict, Any, Optional, Set
from datetime import datetime
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class Permission(str, Enum):
    """Task permissions"""
    VIEW = "view"
    EDIT = "edit"
    COMMENT = "comment"
    DELETE = "delete"
    SHARE = "share"


class TaskShare:
    """Represents a shared task"""
    
    def __init__(
        self,
        task_id: str,
        owner_id: int,
        shared_with_id: int,
        permissions: List[Permission],
        message: Optional[str] = None
    ):
        self.share_id = str(uuid.uuid4())
        self.task_id = task_id
        self.owner_id = owner_id
        self.shared_with_id = shared_with_id
        self.permissions = permissions
        self.message = message
        self.created_at = datetime.utcnow()
        self.accepted = False
        self.accepted_at: Optional[datetime] = None
        self.last_accessed: Optional[datetime] = datetime.utcnow()
    
    def has_permission(self, permission: Permission) -> bool:
        """Check if share has a specific permission"""
        return permission in self.permissions
    
    def accept(self):
        """Accept the shared task"""
        self.accepted = True
        self.accepted_at = datetime.utcnow()
    
    def update_access_time(self):
        """Update last access time"""
        self.last_accessed = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "share_id": self.share_id,
            "task_id": self.task_id,
            "owner_id": self.owner_id,
            "shared_with_id": self.shared_with_id,
            "permissions": [p.value for p in self.permissions],
            "message": self.message,
            "accepted": self.accepted,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None
        }


class TaskComment:
    """Comment on a shared task"""
    
    def __init__(
        self,
        task_id: str,
        author_id: int,
        content: str,
        parent_comment_id: Optional[str] = None
    ):
        self.comment_id = str(uuid.uuid4())
        self.task_id = task_id
        self.author_id = author_id
        self.content = content
        self.parent_comment_id = parent_comment_id  # For nested replies
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.likes: Set[int] = set()  # User IDs who liked this
        self.resolved = False
    
    def update_content(self, new_content: str):
        """Update comment content"""
        self.content = new_content
        self.updated_at = datetime.utcnow()
    
    def toggle_like(self, user_id: int):
        """Toggle like from user"""
        if user_id in self.likes:
            self.likes.remove(user_id)
        else:
            self.likes.add(user_id)
    
    def resolve(self):
        """Mark comment as resolved"""
        self.resolved = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "comment_id": self.comment_id,
            "task_id": self.task_id,
            "author_id": self.author_id,
            "content": self.content,
            "parent_comment_id": self.parent_comment_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "likes": list(self.likes),
            "like_count": len(self.likes),
            "resolved": self.resolved
        }


class CollaborationSession:
    """Real-time collaboration session for a task"""
    
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.session_id = str(uuid.uuid4())
        self.active_editors: Dict[int, Dict[str, Any]] = {}  # user_id -> editor info
        self.started_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.changes_log: List[Dict[str, Any]] = []
    
    def add_editor(self, user_id: int, user_name: str, cursor_position: Optional[int] = None):
        """Add an active editor"""
        self.active_editors[user_id] = {
            "user_id": user_id,
            "user_name": user_name,
            "cursor_position": cursor_position,
            "joined_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        self.last_activity = datetime.utcnow()
    
    def remove_editor(self, user_id: int):
        """Remove an editor from the session"""
        if user_id in self.active_editors:
            del self.active_editors[user_id]
    
    def log_change(self, user_id: int, field: str, old_value: Any, new_value: Any):
        """Log a change to the task"""
        self.changes_log.append({
            "user_id": user_id,
            "field": field,
            "old_value": old_value,
            "new_value": new_value,
            "timestamp": datetime.utcnow().isoformat()
        })
        self.last_activity = datetime.utcnow()
    
    def get_active_editors_list(self) -> List[Dict[str, Any]]:
        """Get list of active editors"""
        return list(self.active_editors.values())
    
    def is_active(self, timeout_seconds: int = 300) -> bool:
        """Check if session is still active"""
        elapsed = (datetime.utcnow() - self.last_activity).total_seconds()
        return elapsed < timeout_seconds
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "task_id": self.task_id,
            "active_editors": self.get_active_editors_list(),
            "editor_count": len(self.active_editors),
            "started_at": self.started_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "changes_count": len(self.changes_log)
        }


class CollaborationService:
    """Manages task sharing and real-time collaboration"""
    
    def __init__(self):
        self.shares: Dict[str, TaskShare] = {}  # share_id -> TaskShare
        self.task_shares: Dict[str, List[TaskShare]] = {}  # task_id -> list of shares
        self.comments: Dict[str, List[TaskComment]] = {}  # task_id -> list of comments
        self.sessions: Dict[str, CollaborationSession] = {}  # session_id -> session
    
    def share_task(
        self,
        task_id: str,
        owner_id: int,
        shared_with_id: int,
        permissions: List[Permission],
        message: Optional[str] = None
    ) -> TaskShare:
        """Share a task with another user"""
        
        # Check if already shared
        existing = self._get_share(task_id, owner_id, shared_with_id)
        if existing:
            logger.warning(f"Task {task_id} already shared with user {shared_with_id}")
            return existing
        
        share = TaskShare(
            task_id=task_id,
            owner_id=owner_id,
            shared_with_id=shared_with_id,
            permissions=permissions,
            message=message
        )
        
        self.shares[share.share_id] = share
        
        if task_id not in self.task_shares:
            self.task_shares[task_id] = []
        self.task_shares[task_id].append(share)
        
        logger.info(f"📤 Task {task_id} shared with user {shared_with_id}")
        return share
    
    def _get_share(
        self,
        task_id: str,
        owner_id: int,
        shared_with_id: int
    ) -> Optional[TaskShare]:
        """Get existing share"""
        shares = self.task_shares.get(task_id, [])
        for share in shares:
            if share.owner_id == owner_id and share.shared_with_id == shared_with_id:
                return share
        return None
    
    def revoke_share(self, share_id: str) -> bool:
        """Revoke a task share"""
        if share_id in self.shares:
            share = self.shares.pop(share_id)
            if share.task_id in self.task_shares:
                self.task_shares[share.task_id].remove(share)
            logger.info(f"🔒 Share {share_id} revoked")
            return True
        return False
    
    def can_user_edit(self, task_id: str, user_id: int) -> bool:
        """Check if user can edit a task"""
        shares = self.task_shares.get(task_id, [])
        for share in shares:
            if share.shared_with_id == user_id and share.has_permission(Permission.EDIT):
                return True
        return False
    
    def can_user_comment(self, task_id: str, user_id: int) -> bool:
        """Check if user can comment on a task"""
        shares = self.task_shares.get(task_id, [])
        for share in shares:
            if share.shared_with_id == user_id and share.has_permission(Permission.COMMENT):
                return True
        return False
    
    def add_comment(
        self,
        task_id: str,
        author_id: int,
        content: str,
        parent_comment_id: Optional[str] = None
    ) -> Optional[TaskComment]:
        """Add a comment to a task"""
        if not self.can_user_comment(task_id, author_id):
            logger.warning(f"User {author_id} cannot comment on task {task_id}")
            return None
        
        comment = TaskComment(
            task_id=task_id,
            author_id=author_id,
            content=content,
            parent_comment_id=parent_comment_id
        )
        
        if task_id not in self.comments:
            self.comments[task_id] = []
        self.comments[task_id].append(comment)
        
        logger.info(f"💬 Comment added to task {task_id}")
        return comment
    
    def get_task_comments(self, task_id: str, parent_only: bool = True) -> List[TaskComment]:
        """Get comments for a task"""
        comments = self.comments.get(task_id, [])
        
        if parent_only:
            comments = [c for c in comments if c.parent_comment_id is None]
        
        # Sort by creation date
        comments.sort(key=lambda x: x.created_at, reverse=True)
        return comments
    
    def start_collaboration_session(self, task_id: str) -> CollaborationSession:
        """Start a real-time collaboration session"""
        session = CollaborationSession(task_id)
        self.sessions[session.session_id] = session
        logger.info(f"🤝 Collaboration session started for task {task_id}")
        return session
    
    def get_or_create_session(self, task_id: str) -> CollaborationSession:
        """Get existing or create new collaboration session"""
        # Find existing active session
        for session in self.sessions.values():
            if session.task_id == task_id and session.is_active():
                return session
        
        # Create new session
        return self.start_collaboration_session(task_id)
    
    def add_collaborator_to_session(
        self,
        session_id: str,
        user_id: int,
        user_name: str
    ) -> bool:
        """Add a collaborator to an active session"""
        if session_id not in self.sessions:
            return False
        
        session = self.sessions[session_id]
        session.add_editor(user_id, user_name)
        logger.info(f"✏️ User {user_id} joined collaboration session")
        return True
    
    def get_user_shared_tasks(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all tasks shared with a user"""
        shared_tasks = []
        
        for share in self.shares.values():
            if share.shared_with_id == user_id:
                shared_tasks.append({
                    "share": share.to_dict(),
                    "comments_count": len(self.comments.get(share.task_id, [])),
                    "is_active": any(
                        s.task_id == share.task_id and s.is_active()
                        for s in self.sessions.values()
                    )
                })
        
        return shared_tasks
    
    def get_collaboration_stats(self) -> Dict[str, Any]:
        """Get collaboration statistics"""
        total_shares = len(self.shares)
        active_sessions = sum(1 for s in self.sessions.values() if s.is_active())
        total_comments = sum(len(c) for c in self.comments.values())
        
        return {
            "total_shares": total_shares,
            "active_collaboration_sessions": active_sessions,
            "total_comments": total_comments,
            "active_editors": sum(
                len(s.active_editors) for s in self.sessions.values()
                if s.is_active()
            )
        }


# Global collaboration service instance
collaboration_service = CollaborationService()
