# -*- coding: utf-8 -*-
"""
高级回测引擎

支持：
1. 多策略回测
2. 参数优化
3. 性能分析
4. 可视化数据生成
"""

import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

from src.data_provider.base import DataProvider
from src.strategies.base_strategy import BaseStrategy

logger = logging.getLogger(__name__)


class AdvancedBacktester:
    """
    高级回测引擎
    
    相比SimpleBacktester，增加了：
    - 更详细的性能指标
    - 参数优化功能
    - 交易成本精确计算
    - 滑点模拟
    """
    
    def __init__(self, data_provider: DataProvider):
        self.data_provider = data_provider
        self.initial_capital = 100000.0
        
        # 回测配置
        self.commission_rate = 0.0003  # 手续费率 万分之三
        self.stamp_tax_rate = 0.001  # 印花税率 千分之一（仅卖出）
        self.slippage_rate = 0.001  # 滑点率 0.1%
        
    def run_backtest(
        self,
        strategy: BaseStrategy,
        stock_code: str,
        start_date: str,
        end_date: str,
        initial_capital: float = 100000.0
    ) -> Dict:
        """
        运行回测
        
        Args:
            strategy: 策略实例
            stock_code: 股票代码
            start_date: 开始日期 YYYYMMDD
            end_date: 结束日期 YYYYMMDD
            initial_capital: 初始资金
        
        Returns:
            回测结果字典
        """
        self.initial_capital = initial_capital
        
        # 获取历史数据
        historical_data = self.data_provider.get_stock_history(stock_code, start_date, end_date)
        
        if historical_data is None or len(historical_data) == 0:
            return {"error": "无法获取历史数据"}
        
        logger.info(f"开始回测: {stock_code}, {start_date} ~ {end_date}")
        
        # 生成交易信号
        signals = strategy.generate_signals(historical_data)
        
        # 执行回测
        result = self._execute_backtest(historical_data, signals, stock_code)
        
        # 添加策略信息
        result['strategy_name'] = strategy.name
        result['strategy_params'] = strategy.get_params()
        
        logger.info(f"回测完成: 收益率 {result['total_return_pct']:.2f}%")
        
        return result
    
    def _execute_backtest(
        self,
        df: pd.DataFrame,
        signals: List[Dict],
        stock_code: str
    ) -> Dict:
        """
        执行回测逻辑
        
        Args:
            df: 历史数据DataFrame
            signals: 交易信号列表
            stock_code: 股票代码
        
        Returns:
            回测结果
        """
        # 初始化账户状态
        cash = self.initial_capital
        position = 0  # 持仓数量
        trades = []  # 交易记录
        equity_curve = []  # 权益曲线
        
        # 按时间排序信号
        signals_sorted = sorted(signals, key=lambda x: x['timestamp'])
        
        for i, row in df.iterrows():
            current_price = row['close']
            current_date = row.name if hasattr(row, 'name') else i
            
            # 检查是否有交易信号
            signal = self._get_signal_at_time(signals_sorted, current_date)
            
            if signal:
                # 执行交易
                trade_result = self._execute_trade(
                    signal=signal,
                    current_price=current_price,
                    cash=cash,
                    position=position
                )
                
                if trade_result:
                    trades.append(trade_result)
                    cash = trade_result['cash_after']
                    position = trade_result['position_after']
            
            # 记录权益曲线
            total_value = cash + position * current_price
            equity_curve.append({
                'date': current_date,
                'price': current_price,
                'cash': cash,
                'position': position,
                'total_value': total_value
            })
        
        # 计算最终结果
        final_value = cash + position * df['close'].iloc[-1]
        
        result = {
            'stock_code': stock_code,
            'initial_capital': self.initial_capital,
            'final_capital': final_value,
            'total_return_pct': (final_value - self.initial_capital) / self.initial_capital * 100,
            'trade_count': len(trades),
            'trades': trades,
            'equity_curve': equity_curve
        }
        
        # 计算性能指标
        performance = self._calculate_performance(equity_curve, trades)
        result.update(performance)
        
        return result
    
    def _get_signal_at_time(
        self,
        signals: List[Dict],
        timestamp
    ) -> Optional[Dict]:
        """获取指定时间的交易信号"""
        for signal in signals:
            if signal['timestamp'] == timestamp:
                return signal
        return None
    
    def _execute_trade(
        self,
        signal: Dict,
        current_price: float,
        cash: float,
        position: int
    ) -> Optional[Dict]:
        """
        执行单笔交易
        
        Args:
            signal: 交易信号
            current_price: 当前价格
            cash: 当前现金
            position: 当前持仓
        
        Returns:
            交易结果
        """
        action = signal['action']
        quantity = signal.get('quantity', 100)
        
        # 应用滑点
        if action == 'BUY':
            exec_price = current_price * (1 + self.slippage_rate)
        else:
            exec_price = current_price * (1 - self.slippage_rate)
        
        # 计算交易成本
        commission = exec_price * quantity * self.commission_rate
        stamp_tax = exec_price * quantity * self.stamp_tax_rate if action == 'SELL' else 0
        total_cost = commission + stamp_tax
        
        if action == 'BUY':
            # 买入
            total_amount = exec_price * quantity + total_cost
            
            if cash >= total_amount:
                cash_after = cash - total_amount
                position_after = position + quantity
                
                return {
                    'date': signal['timestamp'],
                    'action': 'BUY',
                    'price': exec_price,
                    'quantity': quantity,
                    'cost': total_cost,
                    'cash_after': cash_after,
                    'position_after': position_after,
                    'reason': signal.get('reason', '')
                }
        
        elif action == 'SELL':
            # 卖出
            if position >= quantity:
                cash_after = cash + exec_price * quantity - total_cost
                position_after = position - quantity
                
                return {
                    'date': signal['timestamp'],
                    'action': 'SELL',
                    'price': exec_price,
                    'quantity': quantity,
                    'cost': total_cost,
                    'cash_after': cash_after,
                    'position_after': position_after,
                    'reason': signal.get('reason', '')
                }
        
        return None
    
    def _calculate_performance(
        self,
        equity_curve: List[Dict],
        trades: List[Dict]
    ) -> Dict:
        """
        计算性能指标
        
        Args:
            equity_curve: 权益曲线
            trades: 交易记录
        
        Returns:
            性能指标字典
        """
        if not equity_curve:
            return {}
        
        # 转换为DataFrame便于计算
        df_equity = pd.DataFrame(equity_curve)
        
        # 计算收益率序列
        df_equity['return'] = df_equity['total_value'].pct_change()
        
        # 总收益率
        total_return = (df_equity['total_value'].iloc[-1] - df_equity['total_value'].iloc[0]) / df_equity['total_value'].iloc[0] * 100
        
        # 年化收益率
        trading_days = len(df_equity)
        annual_return = (1 + total_return / 100) ** (252 / trading_days) - 1 if trading_days > 0 else 0
        
        # 波动率
        volatility = df_equity['return'].std() * np.sqrt(252) if len(df_equity) > 1 else 0
        
        # Sharpe比率（假设无风险利率3%）
        risk_free_rate = 0.03
        sharpe_ratio = (annual_return - risk_free_rate) / volatility if volatility > 0 else 0
        
        # 最大回撤
        peak = df_equity['total_value'].cummax()
        drawdown = (df_equity['total_value'] - peak) / peak * 100
        max_drawdown = drawdown.min()
        
        # 胜率
        if trades:
            buy_trades = [t for t in trades if t['action'] == 'BUY']
            sell_trades = [t for t in trades if t['action'] == 'SELL']
            
            profitable_trades = 0
            for i in range(len(sell_trades)):
                if i < len(buy_trades):
                    buy_price = buy_trades[i]['price']
                    sell_price = sell_trades[i]['price']
                    if sell_price > buy_price:
                        profitable_trades += 1
            
            win_rate = profitable_trades / len(sell_trades) * 100 if sell_trades else 0
        else:
            win_rate = 0
        
        # 盈亏比
        if trades:
            profits = []
            losses = []
            
            buy_trades = [t for t in trades if t['action'] == 'BUY']
            sell_trades = [t for t in trades if t['action'] == 'SELL']
            
            for i in range(min(len(buy_trades), len(sell_trades))):
                profit_pct = (sell_trades[i]['price'] - buy_trades[i]['price']) / buy_trades[i]['price']
                if profit_pct > 0:
                    profits.append(profit_pct)
                else:
                    losses.append(abs(profit_pct))
            
            avg_profit = np.mean(profits) if profits else 0
            avg_loss = np.mean(losses) if losses else 1
            profit_factor = avg_profit / avg_loss if avg_loss > 0 else 0
        else:
            profit_factor = 0
        
        return {
            'total_return_pct': round(total_return, 2),
            'annual_return_pct': round(annual_return * 100, 2),
            'volatility_pct': round(volatility * 100, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
            'max_drawdown_pct': round(max_drawdown, 2),
            'win_rate_pct': round(win_rate, 2),
            'profit_factor': round(profit_factor, 2),
            'trading_days': trading_days
        }
    
    def optimize_parameters(
        self,
        strategy_class,
        stock_code: str,
        start_date: str,
        end_date: str,
        param_grid: Dict[str, List],
        initial_capital: float = 100000.0
    ) -> List[Dict]:
        """
        参数优化
        
        Args:
            strategy_class: 策略类
            stock_code: 股票代码
            start_date: 开始日期
            end_date: 结束日期
            param_grid: 参数网格 {'param_name': [value1, value2, ...]}
            initial_capital: 初始资金
        
        Returns:
            优化结果列表（按收益率排序）
        """
        from itertools import product
        
        logger.info(f"开始参数优化: {len(param_grid)} 个参数")
        
        # 生成所有参数组合
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        combinations = list(product(*param_values))
        
        logger.info(f"共 {len(combinations)} 种参数组合")
        
        results = []
        
        for combo in combinations:
            params = dict(zip(param_names, combo))
            
            # 创建策略实例
            strategy = strategy_class(**params)
            
            # 运行回测
            result = self.run_backtest(
                strategy=strategy,
                stock_code=stock_code,
                start_date=start_date,
                end_date=end_date,
                initial_capital=initial_capital
            )
            
            if 'error' not in result:
                result['params'] = params
                results.append(result)
        
        # 按收益率排序
        results.sort(key=lambda x: x['total_return_pct'], reverse=True)
        
        logger.info(f"参数优化完成，最佳收益率: {results[0]['total_return_pct']:.2f}%")
        
        return results
