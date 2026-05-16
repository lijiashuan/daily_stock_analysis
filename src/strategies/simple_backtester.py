# -*- coding: utf-8 -*-
"""
简易回测引擎

用于快速验证策略有效性，不依赖前端
"""

import logging
import pandas as pd
import numpy as np
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SimpleBacktester:
    """
    简易回测引擎
    
    支持单策略、单股票的历史回测
    """
    
    def __init__(self, initial_capital: float = 100000.0):
        """
        初始化
        
        Args:
            initial_capital: 初始资金
        """
        self.initial_capital = initial_capital
    
    def run(
        self,
        strategy,
        historical_data: pd.DataFrame,
        stock_code: str = 'TEST',
        commission_rate: float = 0.0003
    ) -> Dict:
        """
        运行回测
        
        Args:
            strategy: 策略实例（需实现 generate_signals）
            historical_data: 历史数据 DataFrame
            stock_code: 股票代码
            commission_rate: 手续费率
        
        Returns:
            回测结果字典
        """
        logger.info(f"开始回测 {stock_code}, 数据长度: {len(historical_data)}")
        
        # 1. 生成信号
        signals = strategy.generate_signals(historical_data)
        
        if not signals:
            logger.warning("未生成任何信号")
            return self._empty_result()
        
        # 2. 模拟交易
        trades = self._simulate_trades(signals, historical_data, commission_rate)
        
        # 3. 计算绩效指标
        metrics = self._calculate_metrics(trades, historical_data)
        
        result = {
            'stock_code': stock_code,
            'initial_capital': self.initial_capital,
            'final_capital': metrics['final_capital'],
            'total_return_pct': metrics['total_return_pct'],
            'sharpe_ratio': metrics['sharpe_ratio'],
            'max_drawdown_pct': metrics['max_drawdown_pct'],
            'win_rate_pct': metrics['win_rate_pct'],
            'profit_factor': metrics['profit_factor'],
            'trade_count': len(trades),
            'trades': trades,
            'signals_count': len(signals)
        }
        
        logger.info(
            f"回测完成: "
            f"收益率={metrics['total_return_pct']:.2f}%, "
            f"胜率={metrics['win_rate_pct']:.1f}%, "
            f"交易次数={len(trades)}"
        )
        
        return result
    
    def _simulate_trades(
        self,
        signals: List[Dict],
        historical_data: pd.DataFrame,
        commission_rate: float
    ) -> List[Dict]:
        """
        模拟交易
        
        Args:
            signals: 信号列表
            historical_data: 历史数据
            commission_rate: 手续费率
        
        Returns:
            交易记录列表
        """
        trades = []
        position = 0  # 当前持仓
        cash = self.initial_capital
        
        for signal in signals:
            action = signal.get('action', 'HOLD')
            price = signal.get('price')
            suggested_qty = signal.get('quantity', 0)
            
            if not price or price <= 0:
                continue
            
            # 获取当日实际价格（用收盘价代替）
            date = signal.get('timestamp')
            if date and date in historical_data.index:
                actual_price = historical_data.loc[date, 'close']
            else:
                actual_price = price
            
            if action == 'BUY' and cash > 0:
                # 买入
                quantity = min(suggested_qty, int(cash / actual_price))
                
                if quantity > 0:
                    cost = quantity * actual_price
                    commission = cost * commission_rate
                    
                    cash -= (cost + commission)
                    position += quantity
                    
                    trades.append({
                        'date': date,
                        'action': 'BUY',
                        'price': actual_price,
                        'quantity': quantity,
                        'commission': commission,
                        'cash_after': cash,
                        'position_after': position
                    })
            
            elif action == 'SELL' and position > 0:
                # 卖出
                quantity = min(suggested_qty, position)
                
                if quantity > 0:
                    revenue = quantity * actual_price
                    commission = revenue * commission_rate
                    
                    cash += (revenue - commission)
                    position -= quantity
                    
                    trades.append({
                        'date': date,
                        'action': 'SELL',
                        'price': actual_price,
                        'quantity': quantity,
                        'commission': commission,
                        'cash_after': cash,
                        'position_after': position
                    })
        
        return trades
    
    def _calculate_metrics(self, trades: List[Dict], historical_data: pd.DataFrame) -> Dict:
        """
        计算绩效指标
        
        Args:
            trades: 交易记录
            historical_data: 历史数据
        
        Returns:
            指标字典
        """
        if not trades:
            return {
                'final_capital': self.initial_capital,
                'total_return_pct': 0,
                'sharpe_ratio': 0,
                'max_drawdown_pct': 0,
                'win_rate_pct': 0,
                'profit_factor': 0
            }
        
        # 1. 最终资金
        final_cash = trades[-1]['cash_after']
        final_position = trades[-1]['position_after']
        
        # 按最后价格计算持仓价值
        last_price = historical_data['close'].iloc[-1]
        final_capital = final_cash + final_position * last_price
        
        # 2. 总收益率
        total_return_pct = ((final_capital - self.initial_capital) / self.initial_capital) * 100
        
        # 3. 胜率和盈亏比
        buy_trades = [t for t in trades if t['action'] == 'BUY']
        sell_trades = [t for t in trades if t['action'] == 'SELL']
        
        winning_trades = []
        losing_trades = []
        
        # 简化：假设每次卖出都对应之前的买入
        for sell_trade in sell_trades:
            # 找到最近的买入
            relevant_buys = [
                t for t in buy_trades 
                if t['date'] < sell_trade['date'] and t['quantity'] >= sell_trade['quantity']
            ]
            
            if relevant_buys:
                buy_price = relevant_buys[-1]['price']
                sell_price = sell_trade['price']
                profit = (sell_price - buy_price) * sell_trade['quantity']
                
                if profit > 0:
                    winning_trades.append(profit)
                else:
                    losing_trades.append(abs(profit))
        
        win_rate_pct = (
            len(winning_trades) / len(sell_trades) * 100 
            if sell_trades else 0
        )
        
        avg_win = sum(winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(losing_trades) / len(losing_trades) if losing_trades else 0
        profit_factor = avg_win / avg_loss if avg_loss > 0 else 0
        
        # 4. Sharpe比率（简化版）
        daily_returns = historical_data['close'].pct_change().dropna()
        if daily_returns.std() > 0:
            sharpe_ratio = (daily_returns.mean() / daily_returns.std()) * np.sqrt(252)
        else:
            sharpe_ratio = 0
        
        # 5. 最大回撤
        equity_curve = self._calculate_equity_curve(trades, historical_data)
        max_drawdown_pct = self._calculate_max_drawdown(equity_curve)
        
        return {
            'final_capital': round(final_capital, 2),
            'total_return_pct': round(total_return_pct, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
            'max_drawdown_pct': round(max_drawdown_pct, 2),
            'win_rate_pct': round(win_rate_pct, 2),
            'profit_factor': round(profit_factor, 2)
        }
    
    def _calculate_equity_curve(self, trades: List[Dict], historical_data: pd.DataFrame) -> pd.Series:
        """计算权益曲线"""
        # 简化实现：只返回关键点的权益
        equity_points = []
        
        cash = self.initial_capital
        position = 0
        
        for trade in trades:
            if trade['action'] == 'BUY':
                cash = trade['cash_after']
                position = trade['position_after']
            else:
                cash = trade['cash_after']
                position = trade['position_after']
            
            # 计算当前权益
            current_price = historical_data.loc[trade['date'], 'close']
            equity = cash + position * current_price
            equity_points.append((trade['date'], equity))
        
        if equity_points:
            dates, values = zip(*equity_points)
            return pd.Series(values, index=pd.to_datetime(dates))
        
        return pd.Series([self.initial_capital])
    
    def _calculate_max_drawdown(self, equity_curve: pd.Series) -> float:
        """计算最大回撤"""
        if len(equity_curve) < 2:
            return 0
        
        peak = equity_curve.expanding().max()
        drawdown = (equity_curve - peak) / peak
        
        return drawdown.min() * 100
    
    def _empty_result(self) -> Dict:
        """返回空结果"""
        return {
            'stock_code': '',
            'initial_capital': self.initial_capital,
            'final_capital': self.initial_capital,
            'total_return_pct': 0,
            'sharpe_ratio': 0,
            'max_drawdown_pct': 0,
            'win_rate_pct': 0,
            'profit_factor': 0,
            'trade_count': 0,
            'trades': [],
            'signals_count': 0
        }


def main():
    """示例用法"""
    print("简易回测引擎示例")
    print("="*60)
    
    # TODO: 这里需要实际的策略和数据
    # from src.strategies.intraday_swing_strategy import IntradaySwingStrategy
    # from src.data_provider.mock_provider import MockDataProvider
    
    print("回测功能已就绪，等待策略实现后使用")


if __name__ == '__main__':
    main()
