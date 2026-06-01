# -*- coding: utf-8 -*-
import os

content = '''# -*- coding: utf-8 -*-
from typing import Optional
from bot.models import BotMessage
from src.tags_manager import TagsManager

class FeishuTagHandler:
    def __init__(self):
        self.tag_name = "飞书传送"
        self.tags_manager = TagsManager()
    
    def process_message(self, message: BotMessage) -> BotMessage:
        try:
            if not hasattr(message, 'tags'):
                message.tags = []
            if self.tag_name not in message.tags:
                message.tags.append(self.tag_name)
            if message.message_id:
                self.tags_manager.assign_tag_to_message(
                    tag_name=self.tag_name,
                    message_id=message.message_id,
                    platform=message.platform,
                    description="Feishu message auto tag"
                )
            return message
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"FeishuTagHandler error: {e}")
            return message

_feishu_tag_handler = None

def get_feishu_tag_handler() -> FeishuTagHandler:
    global _feishu_tag_handler
    if _feishu_tag_handler is None:
        _feishu_tag_handler = FeishuTagHandler()
    return _feishu_tag_handler
'''

with open('bot/handlers/feishu_tag_handler.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('文件创建成功')