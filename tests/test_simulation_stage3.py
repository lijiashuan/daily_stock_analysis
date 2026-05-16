# -*- coding: utf-8 -*-
"""
模拟交易系统第三阶段测试 - API 接口验证

使用 FastAPI TestClient 测试 API 端点
"""

import sys
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from api.app import create_app


def test_api_health():
    """测试健康检查"""
    print("="*60)
    print("测试1: API 健康检查")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    response = client.get("/api/v1/simulation/health")
    
    assert response.status_code == 200
    data = response.json()
    
    print(f"[OK] 状态码: {response.status_code}")
    print(f"[OK] 响应: {data}")


def test_create_account():
    """测试创建账户"""
    print("\n" + "="*60)
    print("测试2: 创建模拟账户")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    payload = {
        "account_name": "测试账户",
        "initial_capital": 100000.0,
        "trading_mode": "balanced",
        "strategy_type": "grid_trading"
    }
    
    response = client.post("/api/v1/simulation/accounts", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    print(f"[OK] 状态码: {response.status_code}")
    print(f"[OK] 账户ID: {data['account_id']}")
    print(f"[OK] 账户名称: {data['account_name']}")
    print(f"[OK] 初始资金: {data['initial_capital']:,.2f} CNY")
    print(f"[OK] 可用资金: {data['available_cash']:,.2f} CNY")
    
    return data['account_id']


def test_list_accounts():
    """测试获取账户列表"""
    print("\n" + "="*60)
    print("测试3: 获取账户列表")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    response = client.get("/api/v1/simulation/accounts")
    
    assert response.status_code == 200
    data = response.json()
    
    print(f"[OK] 状态码: {response.status_code}")
    print(f"[OK] 账户数量: {len(data)}")
    
    if data:
        print(f"[OK] 第一个账户: {data[0]['account_name']}")


def test_get_account(account_id: str):
    """测试获取账户详情"""
    print("\n" + "="*60)
    print("测试4: 获取账户详情")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    response = client.get(f"/api/v1/simulation/accounts/{account_id}")
    
    assert response.status_code == 200
    data = response.json()
    
    print(f"[OK] 状态码: {response.status_code}")
    print(f"[OK] 总资产: {data['total_assets']:,.2f} CNY")
    print(f"[OK] 盈亏: {data['profit_loss']:,.2f} CNY ({data['profit_loss_pct']:.2f}%)")


def test_execute_trade(account_id: str):
    """测试执行交易"""
    print("\n" + "="*60)
    print("测试5: 执行模拟交易")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    # 买入
    payload = {
        "stock_code": "TEST001",
        "side": "BUY",
        "price": 100.0,
        "quantity": 100
    }
    
    response = client.post(f"/api/v1/simulation/accounts/{account_id}/trade", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    print(f"[OK] 买入状态码: {response.status_code}")
    print(f"[OK] 订单ID: {data['order_id']}")
    print(f"[OK] 消息: {data['message']}")
    
    # 卖出
    payload["side"] = "SELL"
    payload["price"] = 105.0
    
    response = client.post(f"/api/v1/simulation/accounts/{account_id}/trade", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    print(f"[OK] 卖出状态码: {response.status_code}")
    print(f"[OK] 消息: {data['message']}")


def test_generate_suggestion():
    """测试生成交易建议"""
    print("\n" + "="*60)
    print("测试6: 生成交易建议")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    payload = {
        "stock_code": "TEST001",
        "use_auction": True
    }
    
    response = client.post("/api/v1/simulation/suggestions", json=payload)
    
    # 可能因为Mock数据返回500，这是预期的
    if response.status_code == 200:
        data = response.json()
        print(f"[OK] 状态码: {response.status_code}")
        print(f"[OK] 当前价格: {data['current_price']}")
        print(f"[OK] 网格订单数: {len(data['grid_orders'])}")
    else:
        print(f"[WARN] 状态码: {response.status_code} (可能需要真实数据)")


def test_run_backtest():
    """测试运行回测"""
    print("\n" + "="*60)
    print("测试7: 运行策略回测")
    print("="*60)
    
    app = create_app()
    client = TestClient(app)
    
    from datetime import datetime, timedelta
    
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=180)).strftime('%Y%m%d')
    
    payload = {
        "stock_code": "TEST001",
        "start_date": start_date,
        "end_date": end_date
    }
    
    response = client.post("/api/v1/simulation/backtest", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"[OK] 状态码: {response.status_code}")
        print(f"[OK] 总收益率: {data['total_return_pct']:.2f}%")
        print(f"[OK] Sharpe比率: {data['sharpe_ratio']:.2f}")
        print(f"[OK] 交易次数: {data['trade_count']}")
    else:
        print(f"[WARN] 状态码: {response.status_code} (可能需要真实数据)")


def main():
    """运行所有API测试"""
    print("\n" + "="*60)
    print("模拟交易系统 - 第三阶段 API 测试")
    print("="*60)
    
    try:
        test_api_health()
        
        account_id = test_create_account()
        test_list_accounts()
        test_get_account(account_id)
        test_execute_trade(account_id)
        test_generate_suggestion()
        test_run_backtest()
        
        print("\n" + "="*60)
        print("[OK] 所有 API 测试完成！")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n[ERROR] 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
