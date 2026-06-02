# -*- coding: utf-8 -*-
"""
Conversation Manager for Agent multi-turn chat.

Manages conversation sessions with TTL, storing message history and context.
"""

import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from src.storage import get_db

logger = logging.getLogger(__name__)

@dataclass
class ConversationSession:
    """A single multi-turn conversation session."""
    session_id: str
    context: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    last_active: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str, original_message_id: str = None):
        """Add a message to the session history.
        
        Args:
            role: Message role ('user' or 'assistant')
            content: Message content
            original_message_id: Original platform message ID (for tag mapping)
        """
        # 保存消息并获取数据库ID
        db_message_id = get_db().save_conversation_message(self.session_id, role, content)
        self.last_active = datetime.now()
        
        # 如果提供了原始消息ID，则更新标签ID映射
        if original_message_id and db_message_id:
            try:
                from src.tags_manager import get_tags_manager
                tags_manager = get_tags_manager()
                # 尝试将原始消息ID映射到数据库消息ID
                tags_manager.update_message_id_mapping(
                    old_message_id=original_message_id,
                    new_message_id=str(db_message_id),
                    platform="feishu"  # 这里暂时硬编码，可以根据实际情况调整
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"更新消息ID映射失败: {e}")

    def update_context(self, key: str, value: Any):
        """Update session context."""
        self.context[key] = value
        self.last_active = datetime.now()

    def get_history(self) -> List[Dict[str, Any]]:
        """Get message history."""
        messages = get_db().get_conversation_history(self.session_id)
        return messages

class ConversationManager:
    """Manages multiple conversation sessions with TTL."""
    
    def __init__(self, ttl_minutes: int = 30):
        self._sessions: Dict[str, ConversationSession] = {}
        self.ttl = timedelta(minutes=ttl_minutes)
        self._lock = threading.RLock()

    def get_or_create(self, session_id: str) -> ConversationSession:
        """Get an existing session or create a new one."""
        with self._lock:
            self._cleanup_expired()

            if session_id not in self._sessions:
                self._sessions[session_id] = ConversationSession(session_id=session_id)
                logger.info(f"Created new conversation session: {session_id}")
            else:
                # Update last active time
                self._sessions[session_id].last_active = datetime.now()

            return self._sessions[session_id]

    def add_message(self, session_id: str, role: str, content: str, original_message_id: str = None):
        """Add a message to a session."""
        session = self.get_or_create(session_id)
        session.add_message(role, content, original_message_id)

    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get message history for a session."""
        session = self.get_or_create(session_id)
        return session.get_history()

    def clear(self, session_id: str):
        """Clear a session."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.info(f"Cleared conversation session: {session_id}")
        # We don't delete from DB here to keep history, or we could add a delete method.
        # For now, just clear from memory.

    def _cleanup_expired(self):
        """Remove expired sessions."""
        with self._lock:
            now = datetime.now()
            expired = [
                sid for sid, session in self._sessions.items()
                if now - session.last_active > self.ttl
            ]
            for sid in expired:
                del self._sessions[sid]
                logger.info(f"Cleaned up expired conversation session: {sid}")

# Global instance
conversation_manager = ConversationManager()