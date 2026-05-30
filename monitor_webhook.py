# -*- coding: utf-8 -*-
"""
实时监控飞书Webhook服务器日志
"""

import time
import requests
import json

def monitor_webhook_server():
    """监控Webhook服务器状态"""
    
    print("=" * 60)
    print("飞书Webhook服务器实时监控")
    print("=" * 60)
    
    webhook_url = "http://127.0.0.1:5000/webhook/feishu"
    
    print(f"\n📡 监控地址: {webhook_url}")
    print(f"🕐 启动时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n💡 现在请从飞书客户端发送消息...")
    print(f"💡 我将实时显示收到的飞书请求和处理结果")
    print(f"💡 按 Ctrl+C 停止监控")
    
    print("\n" + "=" * 60)
    print("等待飞书消息...")
    print("=" * 60 + "\n")
    
    # 发送一个心跳请求来确认服务器在线
    try:
        response = requests.get("http://127.0.0.1:5000/", timeout=2)
        print("✅ Webhook服务器在线")
    except:
        print("❌ Webhook服务器离线")
        return
    
    print("\n📱 现在请从飞书客户端发送测试消息，例如：")
    print("   • '你好'")
    print("   • '帮我分析600519'")
    print("   • '分析一下腾讯控股'")
    print("\n" + "=" * 60 + "\n")
    
    # 持续监控
    last_check = time.time()
    
    while True:
        try:
            time.sleep(1)
            
            # 每30秒显示一次状态
            if time.time() - last_check > 30:
                print(f"🕐 {time.strftime('%H:%M:%S')} - 监控中... (等待飞书消息)")
                last_check = time.time()
                
        except KeyboardInterrupt:
            print("\n\n👋 监控已停止")
            break
        except Exception as e:
            print(f"❌ 监控错误: {e}")
            break


if __name__ == "__main__":
    monitor_webhook_server()