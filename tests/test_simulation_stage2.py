# -*- coding: utf-8 -*-
"""
模拟交易系统第二阶段测试

验证选股器、集合竞价分析器、日内波段策略和回测引擎
"""

import sys
sys.path.insert(0, '.')

import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from src.data_provider.mock_provider import MockDataProvider
from src.strategies.stock_screener import StockScreener
from src.strategies.call_auction_analyzer import CallAuctionAnalyzer
from src.strategies.intraday_swing_strategy import IntradaySwingStrategy
from src.strategies.simple_backtester import SimpleBacktester


def test_stock_screener():
    """测试选股器"""
    print("="*60)
    print("测试1: 选股器")
    print("="*60)
    
    provider = MockDataProvider(seed=42)
    screener = StockScreener(provider)
    
    # 模拟股票列表
    stock_list = [f'STOCK{i:03d}' for i in range(1, 21)]
    
    print(f"\n筛选 {len(stock_list)} 只股票...")
    candidates = screener.screen_stocks(
        stock_list,
        lookback_days=60,
        min_avg_volume=500000,
        min_volatility=0.005,
        max_volatility=0.08
    )
    
    print(f"[OK] 找到 {len(candidates)} 只候选股票\n")
    
    if candidates:
        print("前5名:")
        for i, candidate in enumerate(candidates[:5], 1):
            metrics = candidate['metrics']
            print(f"  {i}. {candidate['stock_code']} - 评分: {candidate['score']:.2f}")
            print(f"     波动率: {metrics['daily_volatility']*100:.2f}%, "
                  f"日均量: {metrics['avg_volume']:.0f}")
    
    # 测试获取Top N
    top_stocks = screener.get_top_stocks(stock_list, top_n=3)
    print(f"\n[OK] Top 3: {[s['stock_code'] for s in top_stocks]}")


def test_call_auction_analyzer():
    """测试集合竞价分析器"""
    print("\n" + "="*60)
    print("测试2: 集合竞价分析器")
    print("="*60)
    
    analyzer = CallAuctionAnalyzer()
    
    # 生成模拟集合竞价数据
    provider = MockDataProvider(seed=123)
    today = datetime.now().strftime('%Y-%m-%d')
    auction_data = provider.get_call_auction_data('TEST001', today)
    
    if auction_data is None:
        print("[FAIL] 无法获取集合竞价数据")
        return
    
    prev_close = 100.0
    
    print(f"\n分析集合竞价数据 ({len(auction_data)} 条记录)...")
    result = analyzer.analyze(auction_data, prev_close)
    
    if result:
        print(f"[OK] 预测开盘价: {result['predicted_open']:.2f}")
        print(f"[OK] 价格区间: {result['price_range'][0]:.2f} - {result['price_range'][1]:.2f}")
        print(f"[OK] 市场情绪: {result['sentiment']} (强度: {result['sentiment_strength']})")
        print(f"[OK] 置信度: {result['confidence']}")
        
        # 生成交易建议
        suggestion = analyzer.generate_trading_suggestion(result, current_position=0)
        print(f"\n交易建议:")
        print(f"  操作: {suggestion['action']}")
        print(f"  原因: {suggestion['reason']}")
    else:
        print("[FAIL] 分析失败")


def test_intraday_swing_strategy():
    """测试日内波段策略"""
    print("\n" + "="*60)
    print("测试3: 日内波段策略")
    print("="*60)
    
    provider = MockDataProvider(seed=456)
    
    # 获取历史数据
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y%m%d')
    historical_data = provider.get_stock_history('TEST001', start_date, end_date)
    
    if historical_data is None:
        print("[FAIL] 无法获取历史数据")
        return
    
    strategy = IntradaySwingStrategy(
        grid_levels=5,
        position_pct=0.6,
        atr_multiplier=1.5
    )
    
    current_price = historical_data['close'].iloc[-1]
    available_cash = 100000.0
    
    print(f"\n当前价格: {current_price:.2f}")
    print(f"可用资金: {available_cash:.2f}")
    
    # 生成网格订单
    orders = strategy.generate_orders(
        historical_data=historical_data,
        current_price=current_price,
        available_cash=available_cash,
        current_position=0
    )
    
    print(f"\n[OK] 生成 {len(orders)} 个网格订单:")
    
    buy_orders = [o for o in orders if o.side == 'BUY']
    sell_orders = [o for o in orders if o.side == 'SELL']
    
    print(f"  买单: {len(buy_orders)} 个")
    for order in buy_orders[:3]:  # 显示前3个
        print(f"    {order.order_type}: {order.quantity}股 @ {order.price:.2f}")
    
    print(f"  卖单: {len(sell_orders)} 个")
    for order in sell_orders[:3]:  # 显示前3个
        print(f"    {order.order_type}: {order.quantity}股 @ {order.price:.2f}")


def test_simple_backtester():
    """测试简易回测引擎"""
    print("\n" + "="*60)
    print("测试4: 简易回测引擎")
    print("="*60)
    
    # 创建一个简单策略用于测试
    class TestStrategy:
        def __init__(self):
            self.name = "TestStrategy"
        
        def generate_signals(self, df):
            signals = []
            
            # 简单的均线交叉策略
            ma_short = df['close'].rolling(5).mean()
            ma_long = df['close'].rolling(20).mean()
            
            for i in range(20, len(df)):
                date = df.index[i]
                
                # 金叉买入
                if ma_short.iloc[i] > ma_long.iloc[i] and ma_short.iloc[i-1] <= ma_long.iloc[i-1]:
                    signals.append({
                        'timestamp': date,
                        'action': 'BUY',
                        'price': df['close'].iloc[i],
                        'quantity': 100,
                        'confidence': 0.7,
                        'reason': '金叉信号'
                    })
                
                # 死叉卖出
                elif ma_short.iloc[i] < ma_long.iloc[i] and ma_short.iloc[i-1] >= ma_long.iloc[i-1]:
                    signals.append({
                        'timestamp': date,
                        'action': 'SELL',
                        'price': df['close'].iloc[i],
                        'quantity': 100,
                        'confidence': 0.7,
                        'reason': '死叉信号'
                    })
            
            return signals
        
        def get_params(self):
            return {}
        
        def set_params(self, params):
            pass
    
    provider = MockDataProvider(seed=789)
    
    # 获取更长的历史数据
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=180)).strftime('%Y%m%d')
    historical_data = provider.get_stock_history('TEST001', start_date, end_date)
    
    if historical_data is None:
        print("[FAIL] 无法获取历史数据")
        return
    
    strategy = TestStrategy()
    backtester = SimpleBacktester(initial_capital=100000.0)
    
    print(f"\n运行回测 (数据长度: {len(historical_data)})...")
    result = backtester.run(strategy, historical_data, stock_code='TEST001')
    
    print(f"\n[OK] 回测结果:")
    print(f"  初始资金: ¥{result['initial_capital']:,.2f}")
    print(f"  最终资金: ¥{result['final_capital']:,.2f}")
    print(f"  总收益率: {result['total_return_pct']:.2f}%")
    print(f"  Sharpe比率: {result['sharpe_ratio']:.2f}")
    print(f"  最大回撤: {result['max_drawdown_pct']:.2f}%")
    print(f"  胜率: {result['win_rate_pct']:.1f}%")
    print(f"  盈亏比: {result['profit_factor']:.2f}")
    print(f"  交易次数: {result['trade_count']}")
    print(f"  信号数量: {result['signals_count']}")


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("模拟交易系统 - 第二阶段测试")
    print("="*60)
    
    try:
        test_stock_screener()
        test_call_auction_analyzer()
        test_intraday_swing_strategy()
        test_simple_backtester()
        
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
