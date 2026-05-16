#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试模拟交易调度器功能

测试步骤：
1. 启动调度器
2. 手动触发每日建议
3. 查看日志输出
4. 停止调度器
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1/simulation"

def print_section(title):
    """打印分节标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_start_scheduler():
    """测试启动调度器"""
    print_section("1. 启动调度器")
    
    try:
        response = requests.post(f"{BASE_URL}/scheduler/start")
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        if response.status_code == 200:
            print("✓ 调度器启动成功")
            return True
        else:
            print("✗ 调度器启动失败")
            return False
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False

def test_trigger_daily_suggestions():
    """测试手动触发每日建议"""
    print_section("2. 手动触发每日建议")
    
    try:
        response = requests.post(f"{BASE_URL}/scheduler/daily-suggestions")
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        if response.status_code == 200:
            print("✓ 每日建议触发成功")
            return True
        else:
            print("✗ 每日建议触发失败")
            return False
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False

def test_generate_suggestion():
    """测试生成交易建议"""
    print_section("3. 生成交易建议（手动）")
    
    try:
        payload = {
            "stock_code": "600519",
            "use_auction": True
        }
        
        response = requests.post(
            f"{BASE_URL}/suggestions",
            json=payload
        )
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"股票代码: {data.get('stock_code')}")
            print(f"当前价格: ¥{data.get('current_price', 0):.2f}")
            print(f"市场情绪: {data.get('sentiment')}")
            print(f"网格订单数: {len(data.get('grid_orders', []))}")
            print(f"\n交易建议:")
            print(data.get('suggestion', 'N/A'))
            print("\n✓ 交易建议生成成功")
            return True
        else:
            print(f"✗ 交易建议生成失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False

def test_stop_scheduler():
    """测试停止调度器"""
    print_section("4. 停止调度器")
    
    try:
        response = requests.post(f"{BASE_URL}/scheduler/stop")
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        if response.status_code == 200:
            print("✓ 调度器停止成功")
            return True
        else:
            print("✗ 调度器停止失败")
            return False
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False

def main():
    """主测试流程"""
    print_section("模拟交易调度器功能测试")
    
    # 1. 启动调度器
    start_success = test_start_scheduler()
    
    # 2. 手动触发每日建议
    daily_success = test_trigger_daily_suggestions()
    
    # 3. 手动生成交易建议
    suggestion_success = test_generate_suggestion()
    
    # 4. 停止调度器
    stop_success = test_stop_scheduler()
    
    # 总结
    print_section("测试结果总结")
    
    all_tests = [
        ("启动调度器", start_success),
        ("触发每日建议", daily_success),
        ("生成交易建议", suggestion_success),
        ("停止调度器", stop_success)
    ]
    
    for test_name, success in all_tests:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status} - {test_name}")
    
    all_passed = all(success for _, success in all_tests)
    
    print(f"\n{'='*60}")
    if all_passed:
        print("🎉 所有测试通过！")
    else:
        print("⚠️  部分测试失败，请检查后端日志")
    print(f"{'='*60}\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
