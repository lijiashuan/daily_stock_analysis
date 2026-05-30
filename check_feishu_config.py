# -*- coding: utf-8 -*-
"""
飞书配置检查工具
"""

import os
import json
from dotenv import load_dotenv

def check_feishu_config():
    """检查飞书配置"""
    
    print("=" * 60)
    print("飞书配置检查")
    print("=" * 60)
    
    # 加载环境变量
    load_dotenv()
    
    # 检查飞书应用配置
    print("\n1️⃣ 飞书应用配置")
    print("-" * 60)
    
    app_id = os.getenv('FEISHU_APP_ID')
    app_secret = os.getenv('FEISHU_APP_SECRET')
    stream_enabled = os.getenv('FEISHU_STREAM_ENABLED')
    
    if app_id:
        print(f"✅ FEISHU_APP_ID: {app_id}")
    else:
        print("❌ FEISHU_APP_ID: 未设置")
    
    if app_secret:
        print(f"✅ FEISHU_APP_SECRET: {app_secret[:10]}...{app_secret[-4:]}")
    else:
        print("❌ FEISHU_APP_SECRET: 未设置")
    
    if stream_enabled:
        print(f"✅ FEISHU_STREAM_ENABLED: {stream_enabled}")
    else:
        print("⚠️  FEISHU_STREAM_ENABLED: 未设置")
    
    # 检查Webhook配置
    print("\n2️⃣ Webhook配置")
    print("-" * 60)
    
    verification_token = os.getenv('FEISHU_VERIFICATION_TOKEN')
    encrypt_key = os.getenv('FEISHU_ENCRYPT_KEY')
    webhook_host = os.getenv('WEBHOOK_HOST', '0.0.0.0')
    webhook_port = os.getenv('WEBHOOK_PORT', '5000')
    
    if verification_token:
        print(f"✅ FEISHU_VERIFICATION_TOKEN: {verification_token[:10]}...{verification_token[-4:]}")
    else:
        print("❌ FEISHU_VERIFICATION_TOKEN: 未设置（URL验证可能失败）")
    
    if encrypt_key:
        print(f"✅ FEISHU_ENCRYPT_KEY: {encrypt_key[:10]}...{encrypt_key[-4:]}")
    else:
        print("⚠️  FEISHU_ENCRYPT_KEY: 未设置（可选）")
    
    print(f"✅ WEBHOOK_HOST: {webhook_host}")
    print(f"✅ WEBHOOK_PORT: {webhook_port}")
    
    # 检查飞书应用权限
    print("\n3️⃣ 飞书应用权限检查清单")
    print("-" * 60)
    
    required_permissions = [
        "im:message",
        "im:message:send_as_bot", 
        "im:chat",
        "im:resource"
    ]
    
    print("请在飞书开发者后台检查以下权限是否已启用：")
    for perm in required_permissions:
        print(f"  ☐ {perm}")
    
    # 检查飞书事件订阅
    print("\n4️⃣ 飞书事件订阅配置")
    print("-" * 60)
    
    webhook_url = f"http://{webhook_host}:{webhook_port}/webhook/feishu"
    print(f"📡 本地Webhook URL: {webhook_url}")
    print(f"📡 局域网Webhook URL: http://192.168.43.250:{webhook_port}/webhook/feishu")
    
    print("\n请在飞书开发者后台检查以下配置：")
    print("  ☐ 事件订阅URL已正确配置")
    print("  ☐ 事件 'im.message.receive_v1' 已启用")
    print("  ☐ URL验证通过")
    
    # 测试飞书API连接
    print("\n5️⃣ 飞书API连接测试")
    print("-" * 60)
    
    try:
        import requests
        
        # 测试获取应用信息
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        data = {
            "app_id": app_id,
            "app_secret": app_secret
        }
        
        print("正在测试飞书API连接...")
        response = requests.post(url, json=data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 0:
                print("✅ 飞书API连接成功")
                print(f"✅ 应用ID: {app_id}")
                print(f"✅ 应用名称: {result.get('app_name', '未知')}")
            else:
                print(f"❌ 飞书API连接失败: {result.get('msg', '未知错误')}")
        else:
            print(f"❌ 飞书API连接失败: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ 飞书API连接测试失败: {e}")
    
    # 诊断建议
    print("\n6️⃣ 诊断建议")
    print("-" * 60)
    
    issues = []
    
    if not verification_token:
        issues.append("1. 设置 FEISHU_VERIFICATION_TOKEN 环境变量")
    
    if not app_id or not app_secret:
        issues.append("2. 检查飞书应用ID和密钥配置")
    
    if issues:
        print("⚠️  发现以下问题需要解决：")
        for issue in issues:
            print(f"  • {issue}")
    else:
        print("✅ 基本配置看起来正常")
    
    print("\n💡 排查步骤：")
    print("1. 检查飞书开发者后台的事件订阅URL是否正确")
    print("2. 确认飞书应用权限已正确配置")
    print("3. 查看Webhook服务器日志，确认是否收到飞书请求")
    print("4. 从飞书客户端发送测试消息，观察服务器日志")
    print("5. 如果使用内网，确保飞书能访问到您的Webhook服务器")
    
    print("\n" + "=" * 60)
    print("配置检查完成")
    print("=" * 60)


if __name__ == "__main__":
    check_feishu_config()