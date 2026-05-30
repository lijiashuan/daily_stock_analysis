# -*- coding: utf-8 -*-
"""
全面调试飞书Stream机器人
"""
import os
import sys
import asyncio

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

async def comprehensive_debug():
    """全面调试飞书Stream"""
    print("=" * 70)
    print("全面调试飞书Stream机器人")
    print("=" * 70)
    
    # 1. 检查配置
    print("\n📋 阶段1: 检查配置")
    from src.config import get_config
    config = get_config()
    
    print(f"  FEISHU_APP_ID: {'✅ 已配置' if config.feishu_app_id else '❌ 未配置'}")
    print(f"  FEISHU_APP_SECRET: {'✅ 已配置' if config.feishu_app_secret else '❌ 未配置'}")
    print(f"  FEISHU_STREAM_ENABLED: {config.feishu_stream_enabled}")
    
    if not config.feishu_stream_enabled:
        print("  ❌ 飞书Stream未启用，请设置FEISHU_STREAM_ENABLED=true")
        return
    
    # 2. 检查FeishuChannel初始化
    print("\n📋 阶段2: 检查FeishuChannel初始化")
    try:
        from lark_oapi.channel import FeishuChannel, OutboundText
        
        channel = FeishuChannel(app_id=config.feishu_app_id, app_secret=config.feishu_app_secret)
        print("  ✅ FeishuChannel初始化成功")
        
        # 3. 测试消息创建
        print("\n📋 阶段3: 测试消息创建")
        test_text = "测试消息：你好，这是一条测试消息"
        outbound_msg = OutboundText(test_text)
        print(f"  ✅ OutboundText创建成功: {test_text[:30]}...")
        
        # 4. 测试消息发送（使用测试chat_id）
        print("\n📋 阶段4: 测试消息发送")
        test_chat_id = "oc_a134f1312b04d53326dc0a7fe71b20f9"
        try:
            result = await channel.send(test_chat_id, outbound_msg)
            print(f"  ✅ 消息发送成功")
            print(f"  结果: {result}")
        except Exception as e:
            print(f"  ❌ 消息发送失败: {e}")
            
    except ImportError as e:
        print(f"  ❌ 无法导入lark_oapi.channel: {e}")
        return
    except Exception as e:
        print(f"  ❌ FeishuChannel初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 5. 检查标签处理
    print("\n📋 阶段5: 检查标签处理")
    try:
        from bot.models import BotMessage, ChatType
        from bot.handlers.feishu_tag_handler import FeishuTagHandler
        
        test_message = BotMessage(
            platform="feishu",
            message_id="test_msg_123",
            user_id="test_user",
            chat_id="test_chat",
            chat_type=ChatType.PRIVATE,
            content="测试消息"
        )
        
        tag_handler = FeishuTagHandler()
        print(f"  标签名称: {tag_handler.tag_name}")
        
        processed = tag_handler.process_message(test_message)
        if hasattr(processed, 'tags'):
            print(f"  ✅ 标签添加成功: {processed.tags}")
        else:
            print(f"  ❌ 标签添加失败")
            
    except Exception as e:
        print(f"  ❌ 标签处理失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 6. 检查消息分发
    print("\n📋 阶段6: 检查消息分发")
    try:
        from bot.dispatcher import get_dispatcher
        
        test_message = BotMessage(
            platform="feishu",
            message_id="test_msg_456",
            user_id="test_user",
            chat_id="test_chat",
            chat_type=ChatType.PRIVATE,
            content="你好"
        )
        
        dispatcher = get_dispatcher()
        response = await dispatcher.dispatch_async(test_message)
        
        if response and response.text:
            print(f"  ✅ 消息分发成功")
            print(f"  响应: {response.text[:50]}...")
        else:
            print(f"  ❌ 消息分发失败或无响应")
            
    except Exception as e:
        print(f"  ❌ 消息分发失败: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("调试完成！")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(comprehensive_debug())