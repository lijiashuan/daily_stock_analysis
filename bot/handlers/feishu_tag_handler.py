# -*- coding: utf-8 -*-
from typing import Optional
from bot.models import BotMessage

class FeishuTagHandler:
    def __init__(self):
        self.tag_name = "飞书传送"
    
    def process_message(self, message: BotMessage) -> BotMessage:
        try:
            if not hasattr(message, 'tags'):
                message.tags = []
            if self.tag_name not in message.tags:
                message.tags.append(self.tag_name)
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