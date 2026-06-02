# -*- coding: utf-8 -*-
"""
检查数据库中消息ID和标签的实际关联情况
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def check_current_mapping():
    """检查当前数据库中消息ID和标签的映射情况"""
    print("🔍 检查数据库中消息ID和标签的实际关联情况")
    
    from src.storage import DatabaseManager, ConversationMessage
    from src.tags_manager import Tag, TagAssignment
    
    db = DatabaseManager()
    
    try:
        with db.session_scope() as session:
            # 检查所有的标签分配
            all_assignments = session.query(TagAssignment).all()
            print(f"📊 总共 {len(all_assignments)} 个标签分配记录")
            
            # 特别关注"飞书传送"标签
            feishu_tag = session.query(Tag).filter(Tag.name == "飞书传送").first()
            if feishu_tag:
                feishu_assignments = session.query(TagAssignment).filter(
                    TagAssignment.tag_id == feishu_tag.id
                ).all()
                
                print(f"🏷️  '飞书传送'标签分配数: {len(feishu_assignments)}")
                
                for assignment in feishu_assignments[:10]:  # 显示前10个
                    print(f"   - 消息ID: {assignment.message_id} (类型: {type(assignment.message_id)}, 长度: {len(assignment.message_id) if assignment.message_id else 0})")
            
            print()
            
            # 检查ConversationMessage表中的消息
            all_messages = session.query(ConversationMessage).filter(
                ConversationMessage.session_id.like('feishu_%')
            ).limit(10).all()
            
            print(f"💬 飞书会话中的消息样本 (前10个):")
            for msg in all_messages:
                print(f"   - DB ID: {msg.id} (类型: {type(msg.id)}), 会话: {msg.session_id[:40]}..., 内容: {msg.content[:50]}...")
            
            print()
            
            # 检查是否有匹配的ID
            matched_count = 0
            for assignment in feishu_assignments:
                for msg in all_messages:
                    if str(msg.id) == assignment.message_id:
                        print(f"✅ 匹配! DB ID {msg.id} = 标签消息ID {assignment.message_id}")
                        print(f"   会话: {msg.session_id}, 内容: {msg.content[:60]}...")
                        matched_count += 1
            
            print(f"\n🔍 匹配结果: {matched_count} 个消息ID匹配")
            
            if matched_count == 0:
                print("💡 提示: 当前标签消息ID可能是原始飞书消息ID，而不是数据库中的自增ID")
                print("   需要在消息保存到数据库后，更新标签分配记录")
        
        return True
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    check_current_mapping()