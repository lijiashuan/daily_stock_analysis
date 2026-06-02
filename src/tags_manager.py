# -*- coding: utf-8 -*-
"""
===================================
标签管理器
===================================

负责标签的创建、管理和消息标签分配
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    DateTime,
    Text,
    UniqueConstraint,
    Index,
    select,
    insert,
    text,
)
from sqlalchemy.orm import relationship

from src.storage import Base, get_db

logger = logging.getLogger(__name__)


# === 数据模型 ===

class Tag(Base):
    """
    标签定义模型
    
    存储标签的基本信息
    """
    __tablename__ = 'tags'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text)
    color = Column(String(20), default='#1890ff')  # 默认蓝色
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # 关系
    assignments = relationship('TagAssignment', back_populates='tag')
    
    def __repr__(self):
        return f"<Tag(id={self.id}, name={self.name})>"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }


class TagAssignment(Base):
    """
    标签分配模型
    
    记录消息与标签的关联关系
    """
    __tablename__ = 'tag_assignments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag_id = Column(Integer, ForeignKey('tags.id'), nullable=False, index=True)
    message_id = Column(String(100), nullable=False, index=True)
    platform = Column(String(20), nullable=False, index=True)  # feishu, dingtalk, etc.
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    # 关系
    tag = relationship('Tag', back_populates='assignments')
    
    # 唯一约束：同一消息在同一平台上同一标签只能分配一次
    __table_args__ = (
        UniqueConstraint('tag_id', 'message_id', 'platform', name='uix_tag_message_platform'),
        Index('ix_message_platform', 'message_id', 'platform'),
    )
    
    def __repr__(self):
        return f"<TagAssignment(tag_id={self.tag_id}, message_id={self.message_id}, platform={self.platform})>"


# === 标签管理器 ===

class TagsManager:
    """
    标签管理器
    
    提供标签的创建、查询和分配功能
    """
    
    def __init__(self):
        """初始化标签管理器"""
        self.db = get_db()
    
    def _ensure_tables(self):
        """确保表存在并处理迁移"""
        try:
            # 使用内部的 engine 属性
            engine = getattr(self.db, '_engine', None)
            if engine is None:
                # 从 session 获取 engine
                with self.db.get_session() as session:
                    engine = session.bind
            
            # 检查 tags 表是否存在以及结构是否正确
            with engine.connect() as conn:
                # 检查 tags 表是否存在
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'"))
                tags_table_exists = result.fetchone() is not None
                
                if tags_table_exists:
                    # 检查列是否存在
                    result = conn.execute(text("PRAGMA table_info(tags)"))
                    columns = [row[1] for row in result.fetchall()]
                    
                    # 逐个检查并添加缺失的列
                    if 'color' not in columns:
                        conn.execute(text("ALTER TABLE tags ADD COLUMN color VARCHAR(20) DEFAULT '#1890ff'"))
                    if 'created_at' not in columns:
                        conn.execute(text("ALTER TABLE tags ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                    if 'updated_at' not in columns:
                        conn.execute(text("ALTER TABLE tags ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                    
                    # 提交更改（如果有）
                    conn.commit()
                    logger.info("已检查/更新 tags 表结构")
            
            # 检查 tag_assignments 表是否存在以及结构是否正确
            with engine.connect() as conn:
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='tag_assignments'"))
                assignments_table_exists = result.fetchone() is not None
                
                if assignments_table_exists:
                    # 检查列是否存在
                    result = conn.execute(text("PRAGMA table_info(tag_assignments)"))
                    columns = [row[1] for row in result.fetchall()]
                    
                    # 逐个检查并添加缺失的列
                    if 'description' not in columns:
                        conn.execute(text("ALTER TABLE tag_assignments ADD COLUMN description TEXT"))
                    if 'created_at' not in columns:
                        conn.execute(text("ALTER TABLE tag_assignments ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                    
                    # 提交更改（如果有）
                    conn.commit()
                    logger.info("已检查/更新 tag_assignments 表结构")
            
            # 如果任一表不存在，创建两个表
            if not tags_table_exists or not assignments_table_exists:
                with engine.connect() as conn:
                    if not tags_table_exists:
                        Tag.__table__.create(bind=engine)
                        logger.info("已创建 tags 表")
                    if not assignments_table_exists:
                        TagAssignment.__table__.create(bind=engine)
                        logger.info("已创建 tag_assignments 表")
                    
        except Exception as e:
            logger.error(f"确保标签表存在失败: {e}")
    
    def get_or_create_tag(self, name: str, description: str = None) -> Dict[str, Any]:
        """
        获取或创建标签
        
        Args:
            name: 标签名称
            description: 标签描述
        
        Returns:
            标签字典，包含 id, name, description 等字段
        """
        self._ensure_tables()
        
        with self.db.session_scope() as session:
            # 尝试查找现有标签
            tag = session.query(Tag).filter(Tag.name == name).first()
            
            if tag:
                # 更新描述（如果提供了新描述）
                if description and tag.description != description:
                    tag.description = description
                    session.commit()
                return tag.to_dict()
            
            # 创建新标签
            tag = Tag(name=name, description=description)
            session.add(tag)
            try:
                session.commit()
                logger.info(f"创建新标签: {name}")
                return tag.to_dict()
            except Exception as e:
                session.rollback()
                # 可能是并发创建，重新查询
                tag = session.query(Tag).filter(Tag.name == name).first()
                if tag:
                    return tag.to_dict()
                raise e
    
    def get_tag_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        根据名称获取标签
        
        Args:
            name: 标签名称
        
        Returns:
            标签字典，如果不存在返回 None
        """
        with self.db.session_scope() as session:
            tag = session.query(Tag).filter(Tag.name == name).first()
            return tag.to_dict() if tag else None
    
    def get_all_tags(self) -> List[Dict[str, Any]]:
        """获取所有标签"""
        with self.db.session_scope() as session:
            tags = session.query(Tag).order_by(Tag.name).all()
            return [tag.to_dict() for tag in tags]
    
    def delete_tag(self, name: str) -> bool:
        """
        删除标签
        
        Args:
            name: 标签名称
        
        Returns:
            是否删除成功
        """
        with self.db.session_scope() as session:
            tag = session.query(Tag).filter(Tag.name == name).first()
            if not tag:
                return False
            
            # 删除关联的标签分配
            session.query(TagAssignment).filter(TagAssignment.tag_id == tag.id).delete()
            
            # 删除标签
            session.delete(tag)
            session.commit()
            logger.info(f"删除标签: {name}")
            return True
    
    def assign_tag_to_message(self, tag_name: str, message_id: str, platform: str, 
                             description: str = None) -> bool:
        """
        为消息分配标签
        
        Args:
            tag_name: 标签名称
            message_id: 消息 ID
            platform: 平台标识（feishu, dingtalk 等）
            description: 分配描述
        
        Returns:
            是否分配成功
        """
        try:
            self._ensure_tables()
            
            with self.db.session_scope() as session:
                # 先获取或创建标签
                tag_info = self.get_or_create_tag(tag_name, description)
                tag_id = tag_info['id']
                
                # 检查是否已分配
                existing = session.query(TagAssignment).filter(
                    TagAssignment.tag_id == tag_id,
                    TagAssignment.message_id == message_id,
                    TagAssignment.platform == platform
                ).first()
                
                if existing:
                    # 更新描述（如果提供了新描述）
                    if description and existing.description != description:
                        existing.description = description
                        session.commit()
                    return True
                
                # 创建新的标签分配
                assignment = TagAssignment(
                    tag_id=tag_id,
                    message_id=message_id,
                    platform=platform,
                    description=description
                )
                session.add(assignment)
                session.commit()
                
                logger.debug(f"为消息 {message_id} 分配标签: {tag_name}")
                return True
                
        except Exception as e:
            logger.error(f"分配标签失败: {e}")
            return False

    def update_message_id_mapping(self, old_message_id: str, new_message_id: str, platform: str) -> bool:
        """
        更新消息ID映射，将原始平台消息ID替换为数据库消息ID
        
        Args:
            old_message_id: 原始消息ID（平台原始ID）
            new_message_id: 新消息ID（数据库自增ID）
            platform: 平台名称
            
        Returns:
            更新是否成功
        """
        try:
            with self.db.session_scope() as session:
                # 更新所有使用原始消息ID的标签分配
                assignments = session.query(TagAssignment).filter(
                    and_(
                        TagAssignment.message_id == old_message_id,
                        TagAssignment.platform == platform
                    )
                ).all()
                
                updated_count = 0
                for assignment in assignments:
                    assignment.message_id = new_message_id
                    updated_count += 1
                
                if updated_count > 0:
                    session.commit()
                    logger.info(f"消息ID映射更新成功: {old_message_id} -> {new_message_id}, 更新了 {updated_count} 条记录")
                
                return updated_count > 0
                
        except Exception as e:
            logger.error(f"更新消息ID映射失败: {e}")
            return False
    
    def remove_tag_from_message(self, tag_name: str, message_id: str, platform: str) -> bool:
        """
        从消息移除标签
        
        Args:
            tag_name: 标签名称
            message_id: 消息 ID
            platform: 平台标识
        
        Returns:
            是否移除成功
        """
        with self.db.session_scope() as session:
            tag = session.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                return False
            
            assignment = session.query(TagAssignment).filter(
                TagAssignment.tag_id == tag.id,
                TagAssignment.message_id == message_id,
                TagAssignment.platform == platform
            ).first()
            
            if not assignment:
                return False
            
            session.delete(assignment)
            session.commit()
            logger.debug(f"从消息 {message_id} 移除标签: {tag_name}")
            return True
    
    def get_tags_for_message(self, message_id: str, platform: str) -> List[Dict[str, Any]]:
        """
        获取消息的所有标签
        
        Args:
            message_id: 消息 ID
            platform: 平台标识
        
        Returns:
            标签字典列表
        """
        with self.db.session_scope() as session:
            tags = session.query(Tag).join(TagAssignment).filter(
                TagAssignment.message_id == message_id,
                TagAssignment.platform == platform
            ).all()
            return [tag.to_dict() for tag in tags]
    
    def get_messages_with_tag(self, tag_name: str, platform: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取带有指定标签的所有消息
        
        Args:
            tag_name: 标签名称
            platform: 平台标识（可选）
        
        Returns:
            消息列表，包含 message_id, platform, description, created_at
        """
        with self.db.session_scope() as session:
            query = session.query(TagAssignment).join(Tag).filter(Tag.name == tag_name)
            
            if platform:
                query = query.filter(TagAssignment.platform == platform)
            
            assignments = query.all()
            
            result = []
            for assignment in assignments:
                result.append({
                    'message_id': assignment.message_id,
                    'platform': assignment.platform,
                    'description': assignment.description,
                    'created_at': assignment.created_at,
                })
            
            return result


# === 全局实例 ===

_tags_manager: Optional[TagsManager] = None


def get_tags_manager() -> TagsManager:
    """
    获取全局标签管理器实例
    
    Returns:
        TagsManager 实例
    """
    global _tags_manager
    
    if _tags_manager is None:
        _tags_manager = TagsManager()
    
    return _tags_manager