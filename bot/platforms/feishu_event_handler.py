# -*- coding: utf-8 -*-
"""
飞书真实事件处理器
用于接收和处理真实的飞书消息
"""

import json
import logging
from typing import Dict, Any, Optional

from bot.platforms.feishu_stream import FeishuStreamHandler
from bot.models import BotMessage, ChatType

logger = logging.getLogger(__name__)


class FeishuEventHandler:
    """飞书事件处理器，处理真实的飞书事件"""
    
    def __init__(self):
        self.stream_handler = FeishuStreamHandler()
    
    def handle_event(self, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        处理飞书事件
        
        Args:
            event_data: 飞书事件数据
            
        Returns:
            响应数据，如果不需要响应则返回None
        """
        try:
            event_type = event_data.get('header', {}).get('event_type')
            
            logger.info(f"收到飞书事件: {event_type}")
            
            if event_type == 'im.message.receive_v1':
                return self._handle_message_receive(event_data)
            else:
                logger.debug(f"忽略事件类型: {event_type}")
                return None
                
        except Exception as e:
            logger.error(f"处理飞书事件时发生错误: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _handle_message_receive(self, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理消息接收事件"""
        try:
            event = event_data.get('event', {})
            message = event.get('message', {})
            
            # 提取消息内容
            content_str = message.get('content', '{}')
            content_dict = json.loads(content_str)
            
            # 根据消息类型提取内容
            msg_type = message.get('msg_type')
            content = ""
            
            if msg_type == 'text':
                content = content_dict.get('text', '').strip()
            elif msg_type == 'post':
                # 富文本消息处理
                post_content = content_dict.get('post', {})
                content = ' '.join([text.get('text', '') for texts in 
                                    post_content.values() for text in texts])
            else:
                logger.info(f"收到非文本消息类型: {msg_type}")
                return None
            
            if not content:
                logger.info("消息内容为空，跳过处理")
                return None
            
            # 获取用户信息
            sender_id = message.get('sender', {}).get('sender_id', {}).get('open_id', '')
            chat_id = message.get('chat_id', '')
            message_id = message.get('message_id', '')
            
            logger.info(f"收到飞书消息: {content} (来自: {sender_id}, 聊天: {chat_id})")
            
            # 创建消息对象
            bot_message = BotMessage(
                platform="feishu",
                message_id=message_id,
                user_id=sender_id,
                user_name=sender_id,
                chat_id=chat_id,
                chat_type=ChatType.PRIVATE,
                content=content,
                raw_content=content_str,
                mentioned=True,
                mentions=[sender_id],
                timestamp=message.get('create_time', ''),
                raw_data=event_data
            )
            
            # 为飞书消息添加标签
            try:
                from bot.handlers.feishu_tag_handler import get_feishu_tag_handler
                tag_handler = get_feishu_tag_handler()
                bot_message = tag_handler.process_message(bot_message)
            except Exception as e:
                logger.error(f"处理飞书消息标签时发生错误: {e}")
            
            # 分发消息给适当的处理器
            import asyncio
            from bot.dispatcher import get_dispatcher
            
            async def process_message():
                dispatcher = get_dispatcher()
                response = await dispatcher.dispatch_async(bot_message)
                
                if response and response.text:
                    # 返回响应数据
                    return {
                        "msg_type": "text",
                        "content": {
                            "text": response.text
                        }
                    }
                return None
            
            # 运行异步处理
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                response_data = loop.run_until_complete(process_message())
                return response_data
            finally:
                loop.close()
                
        except Exception as e:
            logger.error(f"处理飞书消息接收事件时发生错误: {e}")
            import traceback
            traceback.print_exc()
            return None


# 全局事件处理器实例
_event_handler = None

def get_feishu_event_handler() -> FeishuEventHandler:
    """获取飞书事件处理器实例"""
    global _event_handler
    if _event_handler is None:
        _event_handler = FeishuEventHandler()
    return _event_handler


def handle_feishu_event(event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    处理飞书事件的便捷函数
    
    Args:
        event_data: 飞书事件数据
        
    Returns:
        响应数据
    """
    handler = get_feishu_event_handler()
    return handler.handle_event(event_data)