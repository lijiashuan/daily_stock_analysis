# -*- coding: utf-8 -*-
"""
模拟交易系统第一阶段测试

验证数据模型、数据提供者和配对交易管理器
"""

import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
from src.data_provider.mock_provider import MockDataProvider
from src.data_provider.base import DataCache
from src.schemas.simulation_models import (
    SimulationAccount, TradeLeg, OrderRequest, OrderSide, TradingMode
)
from src.strategies.paired_trade_manager import FlexiblePairedTradeManager


def test_data_provider():
    """测试数据提供者"""
    print("="*60)
    print("测试1: 数据提供者")
    print("="*60)
    
    # 创建 Mock 数据提供者
    provider = MockDataProvider(seed=42)
    
    # 测试历史数据
    print("\n1. 获取历史数据...")
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y%m%d')
    
    df = provider.get_stock_history('600519', start_date, end_date)
    
    if df is not None:
        print(f"[OK] 成功获取 {len(df)} 天的历史数据")
        print(f"  最新收盘价: {df['close'].iloc[-1]:.2f}")
        print(f"  最高价: {df['high'].max():.2f}")
        print(f"  最低价: {df['low'].min():.2f}")
    else:
        print("[FAIL] 获取历史数据失败")
    
    # 测试实时行情
    print("\n2. 获取实时行情...")
    quote = provider.get_realtime_quote('600519')
    
    if quote:
        print(f"[OK] 成功获取实时行情")
        print(f"  价格: {quote['price']:.2f}")
        print(f"  涨跌幅: {quote['change_pct']:.2f}%")
    else:
        print("[FAIL] 获取实时行情失败")
    
    # 测试集合竞价数据
    print("\n3. 获取集合竞价数据...")
    today = datetime.now().strftime('%Y-%m-%d')
    auction_df = provider.get_call_auction_data('600519', today)
    
    if auction_df is not None:
        print(f"[OK] 成功获取 {len(auction_df)} 条竞价数据")
    else:
        print("[FAIL] 获取集合竞价数据失败")
    
    print(f"\n[OK] 数据源名称: {provider.get_source_name()}")
    print(f"[OK] 数据源可用: {provider.is_available()}")


def test_cache():
    """测试数据缓存"""
    print("\n" + "="*60)
    print("测试2: 数据缓存")
    print("="*60)
    
    cache = DataCache(cache_dir="data/test_cache")
    
    # 创建测试数据
    import pandas as pd
    import numpy as np
    
    dates = pd.date_range(start='2026-01-01', periods=10, freq='D')
    df = pd.DataFrame({
        'open': np.random.uniform(100, 110, 10),
        'high': np.random.uniform(110, 120, 10),
        'low': np.random.uniform(90, 100, 10),
        'close': np.random.uniform(100, 110, 10),
        'volume': np.random.randint(1e6, 1e7, 10)
    }, index=dates)
    
    # 保存到缓存
    print("\n1. 保存数据到缓存...")
    cache.save_history_cache('TEST001', '20260101', '20260110', 'daily', df)
    print("[OK] 保存成功")
    
    # 从缓存读取
    print("\n2. 从缓存读取数据...")
    cached_df = cache.get_history_cache('TEST001', '20260101', '20260110', 'daily')
    
    if cached_df is not None:
        print(f"[OK] 读取成功，共 {len(cached_df)} 条记录")
    else:
        print("[FAIL] 读取失败")


def test_account():
    """测试模拟账户"""
    print("\n" + "="*60)
    print("测试3: 模拟账户")
    print("="*60)
    
    # 创建账户
    account = SimulationAccount(
        _account_name="测试账户",
        _initial_capital=100000.0,
        trading_mode=TradingMode.BALANCED
    )
    
    print(f"\n1. 账户信息:")
    print(f"  账户ID: {account.account_id}")
    print(f"  初始资金: ¥{account.initial_capital:,.2f}")
    print(f"  可用资金: ¥{account.available_cash:,.2f}")
    
    # 测试买入
    print("\n2. 测试买入...")
    order = OrderRequest(
        stock_code='600519',
        side=OrderSide.BUY,
        price=100.0,
        quantity=100
    )
    
    result = account.place_order(order)
    print(f"  订单结果: {'成功' if result.success else '失败'}")
    print(f"  消息: {result.message}")
    print(f"  剩余资金: ¥{account.available_cash:,.2f}")
    print(f"  持仓: {account.positions}")
    
    # 测试卖出
    print("\n3. 测试卖出...")
    order = OrderRequest(
        stock_code='600519',
        side=OrderSide.SELL,
        price=105.0,
        quantity=100
    )
    
    result = account.place_order(order)
    print(f"  订单结果: {'成功' if result.success else '失败'}")
    print(f"  消息: {result.message}")
    print(f"  剩余资金: ¥{account.available_cash:,.2f}")
    print(f"  持仓: {account.positions}")
    
    # 获取账户摘要
    print("\n4. 账户摘要:")
    summary = account.get_account_summary()
    print(f"  总资产: ¥{summary['total_assets']:,.2f}")
    print(f"  盈亏: ¥{summary['profit_loss']:,.2f} ({summary['profit_loss_pct']:.2f}%)")
    print(f"  交易次数: {summary['trade_count']}")


def test_paired_trade():
    """测试配对交易管理器"""
    print("\n" + "="*60)
    print("测试4: 配对交易管理器")
    print("="*60)
    
    manager = FlexiblePairedTradeManager('600519')
    
    # 添加买单
    print("\n1. 添加买单...")
    buy_trade = TradeLeg(
        stock_code='600519',
        side=OrderSide.BUY,
        price=105.0,  # 提高买入价以便撮合
        quantity=200
    )
    
    group = manager.add_trade(buy_trade)
    print(f"  待配对交易数: {len(manager.get_pending_trades())}")
    print(f"  活跃交易组: {len(manager.get_active_groups())}")
    
    # 添加卖单（部分配对）
    print("\n2. 添加卖单（部分配对）...")
    sell_trade1 = TradeLeg(
        stock_code='600519',
        side=OrderSide.SELL,
        price=105.0,
        quantity=100
    )
    
    group = manager.add_trade(sell_trade1)
    if group:
        print(f"  ✓ 形成配对")
        print(f"  配对数量: {group.total_sell_quantity}")
        print(f"  盈亏: ¥{group.total_profit:.2f}")
    
    # 添加第二个卖单（完全配对）
    print("\n3. 添加第二个卖单（完全配对）...")
    sell_trade2 = TradeLeg(
        stock_code='600519',
        side=OrderSide.SELL,
        price=104.0,  # 降低卖价以便撮合
        quantity=100
    )
    
    group = manager.add_trade(sell_trade2)
    if group:
        print(f"  ✓ 完全配对")
        print(f"  总买入: {group.total_buy_quantity}")
        print(f"  总卖出: {group.total_sell_quantity}")
        print(f"  平均买价: ¥{group.avg_buy_price:.2f}")
        print(f"  平均卖价: ¥{group.avg_sell_price:.2f}")
        print(f"  总盈亏: ¥{group.total_profit:.2f}")
        print(f"  收益率: {group.profit_pct:.2f}%")
    
    # 获取统计
    print("\n4. 统计信息:")
    stats = manager.get_statistics()
    print(f"  已完成交易组: {stats['completed_groups']}")
    print(f"  总盈亏: ¥{stats['total_profit']:.2f}")
    print(f"  胜率: {stats['win_rate']:.1f}%")


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("模拟交易系统 - 第一阶段测试")
    print("="*60)
    
    try:
        test_data_provider()
        test_cache()
        test_account()
        test_paired_trade()
        
        print("\n" + "="*60)
        print("[OK] 所有测试完成！")
        print("="*60)
        
    except Exception as e:
        print(f"\n[FAIL] 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
