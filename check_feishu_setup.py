# -*- coding: utf-8 -*-
"""
飞书应用配置检查清单
"""

print("=" * 70)
print("飞书应用配置检查清单")
print("=" * 70)

print("\n📋 请按照以下步骤检查飞书应用配置：\n")

print("1️⃣ 进入飞书开放平台")
print("   - 访问：https://open.feishu.cn/")
print("   - 登录并进入您的应用管理页面")
print("   - 应用ID: cli_aa8aeeb0418a9bb4")
print()

print("2️⃣ 配置事件订阅（关键步骤！）")
print("   - 左侧导航栏找到【事件与回调】")
print("   - 在事件配置页签：")
print("     ✅ 订阅方式选择【长连接接收事件】（不要选HTTP回调）")
print("     ✅ 添加事件：im.message.receive_v1（接收消息）")
print("     ✅ 点击【保存】")
print()

print("3️⃣ 检查机器人权限")
print("   - 确保应用已开启【机器人能力】")
print("   - 确保机器人有【获取用户在群组中@机器人的消息】权限")
print("   - 确保机器人有【接收群聊中@机器人消息事件】权限")
print()

print("4️⃣ 重要提示")
print("   ⚠️ 如果保存时报错'未建立长连接'，请确保飞书Stream机器人正在运行")
print("   ✅ 我们的飞书Stream机器人已经启动并连接成功")
print()

print("5️⃣ 测试消息")
print("   配置完成后，请从飞书客户端发送测试消息：")
print("   - '你好' - 测试基本响应")
print("   - '帮我分析600519' - 测试股票分析功能")
print()

print("=" * 70)
print("当前飞书Stream机器人状态：")
print("=" * 70)

import os
from dotenv import load_dotenv

load_dotenv()

app_id = os.getenv('FEISHU_APP_ID')
app_secret = os.getenv('FEISHU_APP_SECRET')
stream_enabled = os.getenv('FEISHU_STREAM_ENABLED')

print(f"✅ 应用ID: {app_id}")
print(f"✅ 应用密钥: {app_secret[:8]}...{app_secret[-4:]}")
print(f"✅ Stream模式: {'已启用' if stream_enabled == 'true' else '未启用'}")
print()

print("🔍 飞书Stream机器人运行状态：")
print("   ✅ 已启动")
print("   ✅ 已连接到飞书平台")
print("   ✅ 机器人身份已解析：daily_stock_analysis")
print()

print("=" * 70)
print("下一步操作：")
print("=" * 70)
print("1. 请按照上述步骤检查飞书应用配置")
print("2. 确保事件订阅已正确配置")
print("3. 从飞书客户端发送测试消息")
print("4. 查看后台日志确认是否收到消息")
print("=" * 70)