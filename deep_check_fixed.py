# -*- coding: utf-8 -*-
"""
深入检查飞书消息和标签关联
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.storage import DatabaseManager

def deep_check():
    """深入检查飞书消息和标签关联"""
    print("🔍 深入检查飞书消息和标签关联")
    
    db = DatabaseManager()
    
    try:
        # 检查标签表内容
        with db.session_scope() as session:
            from sqlalchemy import text
            from src.tags_manager import Tag, TagAssignment
            from src.storage import ConversationMessage
            
            # 检查所有标签
            all_tags = session.query(Tag).all()
            print(f"📊 标签总数: {len(all_tags)}")
            for tag in all_tags:
                print(f"   - ID: {tag.id}, 名称: {tag.name}, 描述: {tag.description}")
            
            # 检查特定的"飞书传送"标签
            feishu_tag = session.query(Tag).filter(Tag.name == "飞书传送").first()
            if feishu_tag:
                print(f"🏷️  '飞书传送'标签ID: {feishu_tag.id}")
                
                # 检查有多少消息被标记为飞书传送
                feishu_assignments = session.query(TagAssignment).filter(
                    TagAssignment.tag_id == feishu_tag.id
                ).all()
                print(f"🔗 '飞书传送'标签分配数: {len(feishu_assignments)}")
                
                for assignment in feishu_assignments[:5]:  # 只显示前5个
                    print(f"   - 消息ID: {assignment.message_id}, 平台: {assignment.platform}, 创建时间: {assignment.created_at}")
            
            # 检查ConversationMessage表中的一些飞书会话
            feishu_messages = session.query(ConversationMessage).filter(
                ConversationMessage.session_id.like('feishu_%')
            ).limit(5).all()
            
            print(f"💬 飞书会话中的消息样本:")
            for msg in feishu_messages:
                print(f"   - 会话: {msg.session_id[:30]}..., 消息ID: {msg.id}, 内容: {msg.content[:50]}...")
        
        # 检查特定会话的消息
        sample_session_id = "feishu_ou_d12014d60ccf97d7c031ae8b795cd504:ask_600887_c1d554b8-a110-4f39-851d-50891192a82d"
        print(f"\n🔍 检查会话 {sample_session_id[:50]}...")
        
        with db.session_scope() as session:
            from src.tags_manager import Tag, TagAssignment
            from src.storage import ConversationMessage
            
            messages_in_session = session.query(ConversationMessage).filter(
                ConversationMessage.session_id == sample_session_id
            ).all()
            
            print(f"   该会话中的消息数: {len(messages_in_session)}")
            for i, msg in enumerate(messages_in_session):
                print(f"   {i+1}. 消息ID: {msg.id}, 角色: {msg.role}, 内容: {msg.content[:60]}...")
                
                # 检查该消息是否被标记为飞书传送
                if feishu_tag:
                    msg_has_tag = session.query(TagAssignment).filter(
                        TagAssignment.message_id == str(msg.id),
                        TagAssignment.tag_id == feishu_tag.id
                    ).first()
                    
                    if msg_has_tag:
                        print(f"      ✅ 此消息已标记为'飞书传送'")
                    else:
                        print(f"      ❌ 此消息未标记为'飞书传送'")
        
        return True
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    deep_check()