# -*- coding: utf-8 -*-
"""
调试飞书Stream机器人
"""
import os
import sys
import asyncio

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from src.config import get_config
from lark_oapi.channel import FeishuChannel

async def test_feishu_stream():
    """测试飞书Stream机器人"""
    print("=" * 60)
    print("飞书Stream机器人调试")
    print("=" * 60)
    
    config = get_config()
    
    print(f"配置检查:")
    print(f"  - FEISHU_APP_ID: {config.feishu_app_id}")
    print(f"  - FEISHU_STREAM_ENABLED: {config.feishu_stream_enabled}")
    
    if not config.feishu_stream_enabled:
        print("\n❌ 飞书Stream未启用")
        return
    
    if not config.feishu_app_id or not config.feishu_app_secret:
        print("\n❌ 飞书配置不完整")
        return
    
    try:
        print("\n正在初始化飞书Channel...")
        channel = FeishuChannel(app_id=config.feishu_app_id, app_secret=config.feishu_app_secret)
        print("✅ FeishuChannel初始化成功")
        
        print("\n正在启动飞书Stream连接...")
        
        async def handle_message(msg):
            print(f"\n📥 收到消息: {msg}")
            print(f"   消息类型: {type(msg)}")
            print(f"   是否有content_text: {hasattr(msg, 'content_text')}")
            print(f"   是否有conversation: {hasattr(msg, 'conversation')}")
            print(f"   是否有sender: {hasattr(msg, 'sender')}")
            
            if hasattr(msg, 'content_text'):
                print(f"   内容: {msg.content_text}")
        
        channel.on("message", handle_message)
        
        print("正在连接...")
        # 尝试连接（非阻塞模式）
        try:
            await channel.connect()
            print("✅ 飞书Stream连接成功")
        except Exception as e:
            print(f"⚠️ 连接异常（可能是正常的后台运行）: {e}")
        
        print("\n🎉 飞书Stream机器人已就绪")
        print("请从飞书客户端发送消息测试")
        
        # 保持运行一段时间
        print("\n等待消息... (按Ctrl+C退出)")
        try:
            await asyncio.sleep(30)
        except KeyboardInterrupt:
            print("\n退出测试")
            
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_feishu_stream())