# -*- coding: utf-8 -*-
"""
飞书消息处理流程实时监控脚本
用于监测从飞书消息接收到会话标题显示的完整流程
"""

import sys
import os
import time
import threading
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.storage import DatabaseManager
from src.tags_manager import get_tags_manager
from bot.models import BotMessage, ChatType

class FeishuFlowMonitor:
    def __init__(self):
        self.db = DatabaseManager()
        self.tags_manager = get_tags_manager()
        self.monitoring = False
        self.start_time = None
        
    def start_monitoring(self):
        """开始监控"""
        self.monitoring = True
        self.start_time = datetime.now()
        print(f"⏰ 开始监控飞书消息处理流程 - {self.start_time}")
        print("=" * 60)
        
        # 记录初始状态
        self.log_initial_state()
        
        # 启动监控线程
        monitor_thread = threading.Thread(target=self._monitor_loop)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        return monitor_thread
    
    def log_initial_state(self):
        """记录初始状态"""
        print("📊 初始状态:")
        
        # 获取当前会话总数
        sessions = self.db.get_chat_sessions(limit=100)
        print(f"   • 当前会话总数: {len(sessions)}")
        
        # 获取当前标签总数
        try:
            from sqlalchemy import text
            with self.db.session_scope() as session:
                tag_count = session.execute(text("SELECT COUNT(*) FROM tags")).scalar()
                assignment_count = session.execute(text("SELECT COUNT(*) FROM tag_assignments")).scalar()
                print(f"   • 标签总数: {tag_count}")
                print(f"   • 标签分配总数: {assignment_count}")
                
                # 获取飞书传送标签的数量
                feishu_tag_count = session.execute(
                    text("SELECT COUNT(*) FROM tag_assignments ta JOIN tags t ON ta.tag_id = t.id WHERE t.name = '飞书传送'")
                ).scalar()
                print(f"   • 飞书传送标签数量: {feishu_tag_count}")
        except Exception as e:
            print(f"   • 标签统计错误: {e}")
    
    def _monitor_loop(self):
        """监控循环"""
        previous_session_count = len(self.db.get_chat_sessions(limit=100))
        previous_feishu_count = self._get_feishu_tag_count()
        
        while self.monitoring:
            time.sleep(1)  # 每秒检查一次
            
            # 检查会话数量变化
            current_session_count = len(self.db.get_chat_sessions(limit=100))
            current_feishu_count = self._get_feishu_tag_count()
            
            if current_session_count != previous_session_count:
                print(f"📈 会话数量变化: {previous_session_count} → {current_session_count}")
                previous_session_count = current_session_count
                
                # 获取最新的会话列表
                sessions = self.db.get_chat_sessions(limit=10)
                if sessions:
                    latest_session = sessions[0]  # 最新的会话
                    print(f"🆕 最新会话: '{latest_session['title']}' (ID: {latest_session['session_id']})")
                    
                    # 检查是否包含飞书标识
                    if "[飞书传送]" in latest_session['title']:
                        print(f"✅ 发现带'[飞书传送]'标识的会话!")
                    else:
                        print(f"ℹ️  会话无'[飞书传送]'标识")
            
            if current_feishu_count != previous_feishu_count:
                print(f"🏷️  飞书传送标签数量变化: {previous_feishu_count} → {current_feishu_count}")
                previous_feishu_count = current_feishu_count
    
    def _get_feishu_tag_count(self):
        """获取飞书传送标签数量"""
        try:
            from sqlalchemy import text
            with self.db.session_scope() as session:
                count = session.execute(
                    text("SELECT COUNT(*) FROM tag_assignments ta JOIN tags t ON ta.tag_id = t.id WHERE t.name = '飞书传送'")
                ).scalar()
                return count or 0
        except Exception:
            return 0
    
    def check_latest_messages_and_sessions(self):
        """检查最新消息和会话"""
        print("\n🔍 检查最新状态:")
        
        # 获取最新会话
        sessions = self.db.get_chat_sessions(limit=5)
        print(f"   最近5个会话:")
        for i, session in enumerate(sessions[:3]):  # 只显示前3个
            print(f"   {i+1}. '{session['title']}' (消息数: {session['message_count']})")
        
        # 检查是否有带飞书标签的会话
        feishu_sessions = [s for s in sessions if "[飞书传送]" in s['title']]
        if feishu_sessions:
            print(f"   ✅ 发现 {len(feishu_sessions)} 个带'[飞书传送]'标识的会话")
            for session in feishu_sessions:
                print(f"      - {session['title']}")
        else:
            print(f"   ℹ️  暂无带'[飞书传送]'标识的会话")
        
        # 检查标签分配情况
        try:
            with self.db.session_scope() as session:
                from sqlalchemy import text
                latest_assignments = session.execute(
                    text("""
                        SELECT ta.message_id, t.name, ta.created_at 
                        FROM tag_assignments ta 
                        JOIN tags t ON ta.tag_id = t.id 
                        ORDER BY ta.created_at DESC 
                        LIMIT 5
                    """)
                ).fetchall()
                
                if latest_assignments:
                    print(f"   最新5个标签分配:")
                    for assignment in latest_assignments:
                        print(f"   - 消息ID: {assignment[0]}, 标签: {assignment[1]}, 时间: {assignment[2]}")
        except Exception as e:
            print(f"   标签检查错误: {e}")
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        end_time = datetime.now()
        duration = end_time - self.start_time
        print(f"\n⏱️  监控结束 - 持续时间: {duration}")
        print("=" * 60)
        
        # 最终状态检查
        self.check_latest_messages_and_sessions()

def main():
    print("🚀 飞书消息处理流程实时监控器")
    print("请在另一个窗口发送飞书消息，本监控器将实时追踪处理流程...")
    
    monitor = FeishuFlowMonitor()
    monitor_thread = monitor.start_monitoring()
    
    try:
        print("\n📝 说明:")
        print("- 监控将持续运行直到您按下 Ctrl+C")
        print("- 发送飞书消息后，观察实时变化")
        print("- 重点关注会话标题是否出现'[飞书传送]'标识")
        print()
        
        while True:
            time.sleep(0.1)  # 让主线程保持运行
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断监控...")
        monitor.stop_monitoring()
        print("监控已停止。")

if __name__ == "__main__":
    main()