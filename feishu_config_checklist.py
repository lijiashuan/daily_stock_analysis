# -*- coding: utf-8 -*-
"""
飞书配置详细检查清单
"""

import os
from dotenv import load_dotenv

def detailed_feishu_checklist():
    """详细的飞书配置检查清单"""
    
    print("=" * 70)
    print("飞书集成配置详细检查清单")
    print("=" * 70)
    
    load_dotenv()
    
    # 1. 环境变量检查
    print("\n📋 1. 环境变量检查")
    print("-" * 70)
    
    env_vars = {
        'FEISHU_APP_ID': os.getenv('FEISHU_APP_ID'),
        'FEISHU_APP_SECRET': os.getenv('FEISHU_APP_SECRET'),
        'FEISHU_VERIFICATION_TOKEN': os.getenv('FEISHU_VERIFICATION_TOKEN'),
        'FEISHU_STREAM_ENABLED': os.getenv('FEISHU_STREAM_ENABLED'),
        'WEBHOOK_HOST': os.getenv('WEBHOOK_HOST', '0.0.0.0'),
        'WEBHOOK_PORT': os.getenv('WEBHOOK_PORT', '5000'),
    }
    
    for var_name, var_value in env_vars.items():
        if var_value:
            if 'SECRET' in var_name or 'TOKEN' in var_name:
                display_value = f"{var_value[:8]}...{var_value[-4:]}"
            else:
                display_value = var_value
            print(f"✅ {var_name}: {display_value}")
        else:
            print(f"❌ {var_name}: 未设置")
    
    # 2. 飞书开发者后台配置检查
    print("\n📋 2. 飞书开发者后台配置检查")
    print("-" * 70)
    
    print("请访问 https://open.feishu.cn/app 并检查以下配置：")
    print()
    
    print("🔹 应用基本信息")
    print("   ☐ 应用ID: cli_aa8aeeb0418a9bb4")
    print("   ☐ 应用状态: 已启用")
    print()
    
    print("🔹 事件订阅配置")
    print("   ☐ 请求地址已配置")
    print("   ☐ 事件 'im.message.receive_v1' 已启用")
    print("   ☐ URL验证状态: 已通过")
    print()
    
    print("🔹 权限管理配置")
    permissions = [
        "im:message",
        "im:message:send_as_bot",
        "im:chat",
        "im:resource"
    ]
    for perm in permissions:
        print(f"   ☐ {perm}")
    print()
    
    print("🔹 机器人配置")
    print("   ☐ 机器人已启用")
    print("   ☐ 机器人可见性: 可见")
    print()
    
    # 3. Webhook服务器检查
    print("📋 3. Webhook服务器检查")
    print("-" * 70)
    
    webhook_url = f"http://{env_vars['WEBHOOK_HOST']}:{env_vars['WEBHOOK_PORT']}/webhook/feishu"
    local_url = f"http://127.0.0.1:{env_vars['WEBHOOK_PORT']}/webhook/feishu"
    lan_url = f"http://192.168.43.250:{env_vars['WEBHOOK_PORT']}/webhook/feishu"
    
    print(f"📡 本地URL: {local_url}")
    print(f"📡 局域网URL: {lan_url}")
    print(f"📡 配置URL: {webhook_url}")
    print()
    print("⚠️  重要提醒:")
    print("   • 飞书平台在公网上，无法直接访问局域网地址")
    print("   • 需要使用内网穿透工具或公网服务器")
    print("   • 推荐使用ngrok: https://ngrok.com")
    print()
    
    # 4. 网络连接检查
    print("📋 4. 网络连接检查")
    print("-" * 70)
    
    print("🔹 内网访问测试")
    print("   请在浏览器中访问以下URL测试：")
    print(f"   • {local_url}")
    print(f"   • {lan_url}")
    print()
    
    print("🔹 飞书API连接测试")
    try:
        import requests
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        data = {
            "app_id": env_vars['FEISHU_APP_ID'],
            "app_secret": env_vars['FEISHU_APP_SECRET']
        }
        response = requests.post(url, json=data, timeout=10)
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 0:
                print("   ✅ 飞书API连接成功")
            else:
                print(f"   ❌ 飞书API连接失败: {result.get('msg')}")
        else:
            print(f"   ❌ 飞书API连接失败: HTTP {response.status_code}")
    except Exception as e:
        print(f"   ❌ 飞书API连接测试失败: {e}")
    print()
    
    # 5. 常见问题排查
    print("📋 5. 常见问题排查")
    print("-" * 70)
    
    print("🔹 问题: 飞书无法访问Webhook服务器")
    print("   原因: 飞书平台在公网，无法访问内网地址")
    print("   解决: 使用内网穿透工具 (ngrok, frp, 花生壳等)")
    print()
    
    print("🔹 问题: 收到请求但无响应")
    print("   原因: 权限配置不正确或处理逻辑错误")
    print("   解决: 检查飞书权限配置和服务器日志")
    print()
    
    print("🔹 问题: URL验证失败")
    print("   原因: VERIFICATION_TOKEN配置错误")
    print("   解决: 检查.env文件中的FEISHU_VERIFICATION_TOKEN")
    print()
    
    # 6. 下一步操作建议
    print("📋 6. 下一步操作建议")
    print("-" * 70)
    
    print("🚀 立即操作:")
    print("   1. 下载并安装ngrok: https://ngrok.com/download")
    print("   2. 启动ngrok: ngrok http 5000")
    print("   3. 复制ngrok提供的公网URL")
    print("   4. 在飞书开发者后台更新事件订阅URL")
    print("   5. 从飞书客户端发送测试消息")
    print()
    
    print("📱 测试消息建议:")
    print("   • '你好' - 测试基本响应")
    print("   • '帮我分析600519' - 测试股票分析")
    print("   • '分析一下腾讯控股' - 测试自然语言处理")
    print()
    
    print("🔍 监控和调试:")
    print("   • 查看ngrok日志，确认收到飞书请求")
    print("   • 查看Webhook服务器日志，确认处理过程")
    print("   • 检查飞书开发者后台的事件订阅状态")
    print()
    
    print("=" * 70)
    print("检查清单完成")
    print("=" * 70)
    print("\n💡 如果所有配置都正确但仍然无法工作，")
    print("💡 最可能的原因是网络连接问题，请使用内网穿透工具。")


if __name__ == "__main__":
    detailed_feishu_checklist()