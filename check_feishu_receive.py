# -*- coding: utf-8 -*-
"""
检查飞书消息接收状态
"""
import os
import sys
import asyncio

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

async def check_feishu_receive():
    """检查飞书消息接收"""
    print("=" * 60)
    print("检查飞书消息接收状态")
    print("=" * 60)
    
    from src.config import get_config
    from lark_oapi.channel import FeishuChannel
    
    config = get_config()
    
    if not config.feishu_stream_enabled:
        print("❌ 飞书Stream未启用")
        return
    
    print("\n正在启动飞书Stream监听...")
    print("请从飞书客户端发送消息测试")
    print("（按Ctrl+C退出）\n")
    
    # 记录收到的消息
    received_messages = []
    
    def handle_message(msg):
        try:
            content = msg.content_text if hasattr(msg, 'content_text') else str(msg.content)
            chat_id = msg.conversation.chat_id if hasattr(msg, 'conversation') else ''
            sender_id = getattr(msg.sender, 'open_id', '') if hasattr(msg, 'sender') else ''
            
            print(f"\n📥 收到消息！")
            print(f"   内容: {content}")
            print(f"   发送者: {sender_id}")
            print(f"   聊天ID: {chat_id}")
            
            received_messages.append({
                'content': content,
                'sender_id': sender_id,
                'chat_id': chat_id
            })
            
            # 测试标签处理
            try:
                from bot.models import BotMessage, ChatType
                from bot.handlers.feishu_tag_handler import FeishuTagHandler
                
                bot_message = BotMessage(
                    platform="feishu",
                    message_id=msg.message_id if hasattr(msg, 'message_id') else '',
                    user_id=sender_id,
                    user_name=sender_id,
                    chat_id=chat_id,
                    chat_type=ChatType.PRIVATE,
                    content=content,
                    raw_content=str(msg.content),
                    mentioned=True,
                    mentions=[sender_id],
                    timestamp=str(msg.create_time) if hasattr(msg, 'create_time') else '',
                    raw_data=msg
                )
                
                tag_handler = FeishuTagHandler()
                bot_message = tag_handler.process_message(bot_message)
                
                print(f"   ✅ 标签处理成功: {bot_message.tags if hasattr(bot_message, 'tags') else '无标签'}")
                
                # 测试消息分发
                from bot.dispatcher import get_dispatcher
                
                dispatcher = get_dispatcher()
                response = asyncio.create_task(dispatcher.dispatch_async(bot_message))
                
                print(f"   ✅ 消息分发已启动")
                
            except Exception as e:
                print(f"   ❌ 消息处理失败: {e}")
                
        except Exception as e:
            print(f"❌ 处理消息时出错: {e}")
            import traceback
            traceback.print_exc()
    
    try:
        channel = FeishuChannel(app_id=config.feishu_app_id, app_secret=config.feishu_app_secret)
        channel.on("message", handle_message)
        
        await channel.connect()
        
        print("✅ 飞书Stream已连接，等待消息...")
        
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n🛑 退出监听")
        if received_messages:
            print(f"\n📊 共收到 {len(received_messages)} 条消息")
            for i, msg in enumerate(received_messages, 1):
                print(f"   {i}. {msg['content'][:30]}...")
        else:
            print("\n⚠️ 未收到任何消息")
            
    except Exception as e:
        print(f"\n❌ 连接失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_feishu_receive())