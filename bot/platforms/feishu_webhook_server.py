# -*- coding: utf-8 -*-
"""
飞书Webhook服务器
用于接收飞书的事件推送
"""

import json
import logging
import hashlib
import hmac
import base64
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify

from bot.platforms.feishu_event_handler import handle_feishu_event

logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)

# 飞书验证配置
FEISHU_VERIFICATION_TOKEN = None
FEISHU_ENCRYPT_KEY = None


def configure_webhook(verification_token: str, encrypt_key: Optional[str] = None):
    """
    配置Webhook验证参数
    
    Args:
        verification_token: 飞书验证令牌
        encrypt_key: 飞书加密密钥（可选）
    """
    global FEISHU_VERIFICATION_TOKEN, FEISHU_ENCRYPT_KEY
    FEISHU_VERIFICATION_TOKEN = verification_token
    FEISHU_ENCRYPT_KEY = encrypt_key
    logger.info("飞书Webhook配置完成")


@app.route('/webhook/feishu', methods=['POST'])
def feishu_webhook():
    """处理飞书Webhook事件"""
    try:
        # 获取请求数据
        event_data = request.get_json()
        
        print(f"\n{'='*60}")
        print(f"📥 收到飞书Webhook请求")
        print(f"{'='*60}")
        
        if not event_data:
            logger.warning("收到空的飞书Webhook请求")
            print("❌ 收到空的飞书Webhook请求")
            return jsonify({"code": 400, "msg": "Bad Request"}), 400
        
        print(f"📋 请求数据: {json.dumps(event_data, ensure_ascii=False, indent=2)}")
        logger.info(f"收到飞书Webhook事件: {json.dumps(event_data, ensure_ascii=False)}")
        
        # 检查是否为URL验证请求
        if event_data.get('type') == 'url_verification':
            print("🔍 识别为URL验证请求")
            return handle_url_verification(event_data)
        
        # 处理飞书事件
        print("🔍 开始处理飞书事件...")
        response_data = handle_feishu_event(event_data)
        
        if response_data:
            print(f"✅ 事件处理成功，返回响应: {json.dumps(response_data, ensure_ascii=False, indent=2)}")
            return jsonify({"code": 0, "msg": "success", "data": response_data}), 200
        else:
            print("✅ 事件处理完成，无响应数据")
            return jsonify({"code": 0, "msg": "success"}), 200
            
    except Exception as e:
        logger.error(f"处理飞书Webhook时发生错误: {e}")
        print(f"❌ 处理飞书Webhook时发生错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"code": 500, "msg": f"Internal Server Error: {str(e)}"}), 500


def handle_url_verification(event_data: Dict[str, Any]) -> tuple:
    """
    处理URL验证请求
    
    Args:
        event_data: 飞书URL验证请求数据
        
    Returns:
        Flask响应
    """
    try:
        challenge = event_data.get('challenge')
        token = event_data.get('token')
        
        # 验证token
        if FEISHU_VERIFICATION_TOKEN and token != FEISHU_VERIFICATION_TOKEN:
            logger.warning("飞书URL验证失败：token不匹配")
            return jsonify({"code": 403, "msg": "Forbidden"}), 403
        
        logger.info("飞书URL验证成功")
        return jsonify({"challenge": challenge}), 200
        
    except Exception as e:
        logger.error(f"处理飞书URL验证时发生错误: {e}")
        return jsonify({"code": 500, "msg": "Internal Server Error"}), 500


def start_webhook_server(host: str = '0.0.0.0', port: int = 5000):
    """
    启动Webhook服务器
    
    Args:
        host: 监听地址
        port: 监听端口
    """
    logger.info(f"启动飞书Webhook服务器: {host}:{port}")
    logger.info(f"Webhook URL: http://{host}:{port}/webhook/feishu")
    
    # 在生产环境中，建议使用WSGI服务器如Gunicorn
    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)s | %(message)s'
    )
    
    # 从环境变量加载配置
    import os
    verification_token = os.getenv('FEISHU_VERIFICATION_TOKEN', '')
    encrypt_key = os.getenv('FEISHU_ENCRYPT_KEY', '')
    
    if verification_token:
        configure_webhook(verification_token, encrypt_key)
    else:
        logger.warning("未设置FEISHU_VERIFICATION_TOKEN，URL验证可能失败")
    
    # 启动服务器
    start_webhook_server()