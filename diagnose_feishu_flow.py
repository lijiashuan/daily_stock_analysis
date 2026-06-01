# -*- coding: utf-8 -*-
"""
飞书消息流程诊断工具
"""
import os
import sys
import asyncio

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

async def diagnose_feishu_flow():
    """诊断飞书消息流程"""
    print("=" * 70)
    print("飞书消息流程诊断")
    print("=" * 70)
    
    # 1. 检查配置
    print("\n📋 阶段1: 检查配置")
    from src.config import get_config
    config = get_config()
    
    print(f"  FEISHU_APP_ID: {'✅ 已配置' if config.feishu_app_id else '❌ 未配置'}")
    print(f"  FEISHU_APP_SECRET: {'✅ 已配置' if config.feishu_app_secret else '❌ 未配置'}")
    print(f"  FEISHU_WEBHOOK_URL: {'✅ 已配置' if config.feishu_webhook_url else '❌ 未配置'}")
    print(f"  FEISHU_STREAM_ENABLED: {config.feishu_stream_enabled}")
    
    if not config.feishu_stream_enabled:
        print("  ❌ 飞书Stream未启用，请设置FEISHU_STREAM_ENABLED=true")
        return
    
    # 2. 检查FeishuChannel连接
    print("\n📋 阶段2: 检查FeishuChannel连接")
    try:
        from lark_oapi.channel import FeishuChannel
        
        channel = FeishuChannel(app_id=config.feishu_app_id, app_secret=config.feishu_app_secret)
        print("  ✅ FeishuChannel初始化成功")
        
        # 测试连接
        print("  正在连接到飞书...")
        channel.start_background()
        
        import time
        time.sleep(3)
        
        if channel.is_ready:
            print(f"  ✅ 连接成功")
            print(f"  Bot身份: {channel.bot_identity.name}")
            print(f"  Open ID: {channel.bot_identity.open_id}")
        else:
            print("  ❌ 连接失败")
            
        channel.stop_background()
        
    except Exception as e:
        print(f"  ❌ FeishuChannel连接失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 3. 检查消息处理器
    print("\n📋 阶段3: 检查消息处理器")
    try:
        from bot.dispatcher import get_dispatcher
        
        dispatcher = get_dispatcher()
        print("  ✅ 消息分发器初始化成功")
        
        # 测试分发
        from bot.models import BotMessage, ChatType
        
        test_message = BotMessage(
            platform="feishu",
            message_id="test_msg_001",
            user_id="test_user",
            user_name="测试用户",
            chat_id="test_chat",
            chat_type=ChatType.PRIVATE,
            content="601396",
            raw_content="601396",
            mentioned=True,
            mentions=["test_user"],
            timestamp="2024-01-01 00:00:00",
            raw_data={}
        )
        
        print("  测试消息分发...")
        response = await dispatcher.dispatch_async(test_message)
        
        if response and response.text:
            print(f"  ✅ AI响应成功")
            print(f"  响应内容: {response.text[:100]}...")
        else:
            print("  ❌ AI无响应")
            
    except Exception as e:
        print(f"  ❌ 消息分发失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 4. 检查发送功能
    print("\n📋 阶段4: 检查发送功能")
    try:
        from src.notification_sender import FeishuSender
        
        feishu_sender = FeishuSender(config)
        print("  ✅ FeishuSender初始化成功")
        
        test_content = "🧪 测试消息：飞书发送功能正常"
        print(f"  测试发送消息: {test_content}")
        
        success = feishu_sender.send_to_feishu(test_content)
        
        if success:
            print("  ✅ 消息发送成功")
        else:
            print("  ❌ 消息发送失败，请检查Webhook配置")
            
    except Exception as e:
        print(f"  ❌ FeishuSender失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 5. 检查标签处理
    print("\n📋 阶段5: 检查标签处理")
    try:
        from bot.handlers.feishu_tag_handler import FeishuTagHandler, get_feishu_tag_handler
        
        tag_handler = get_feishu_tag_handler()
        print(f"  ✅ 标签处理器初始化成功")
        print(f"  标签名称: {tag_handler.tag_name}")
        
        # 测试标签处理
        test_message = BotMessage(
            platform="feishu",
            message_id="test_tag_msg",
            user_id="test_user",
            user_name="测试用户",
            chat_id="test_chat",
            chat_type=ChatType.PRIVATE,
            content="测试消息",
            raw_content="测试消息",
            mentioned=True,
            mentions=["test_user"],
            timestamp="2024-01-01 00:00:00",
            raw_data={}
        )
        
        processed = tag_handler.process_message(test_message)
        if hasattr(processed, 'tags') and processed.tags:
            print(f"  ✅ 标签添加成功: {processed.tags}")
        else:
            print("  ⚠️ 标签未添加")
            
    except Exception as e:
        print(f"  ❌ 标签处理失败: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("诊断完成！")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(diagnose_feishu_flow())