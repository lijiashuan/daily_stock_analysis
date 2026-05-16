# -*- coding: utf-8 -*-
"""
T+1 交易引擎

实现A股T+1交易规则：
- 当日买入的股票次日才能卖出
- 管理可用持仓和冻结持仓
"""

import logging
from typing import Dict, List, Optional
from datetime import date, timedelta
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PositionLot:
    """
    持仓批次
    
    记录每一笔买入的持仓，用于T+1规则判断
    """
    stock_code: str
    quantity: int
    buy_date: date
    buy_price: float
    is_available: bool = False  # 是否可卖出（T+1后）
    
    def make_available(self):
        """使持仓可卖出（T+1后）"""
        self.is_available = True


class T1TradingEngine:
    """
    T+1 交易引擎
    
    管理持仓的T+1状态，确保遵守交易规则
    """
    
    def __init__(self):
        """初始化引擎"""
        # {stock_code: [PositionLot, ...]}
        self.position_lots: Dict[str, List[PositionLot]] = {}
        
        logger.info("T+1 Trading Engine initialized")
    
    def add_buy_position(
        self,
        stock_code: str,
        quantity: int,
        price: float,
        trade_date: date
    ):
        """
        添加买入持仓
        
        Args:
            stock_code: 股票代码
            quantity: 数量
            price: 价格
            trade_date: 交易日期
        """
        if stock_code not in self.position_lots:
            self.position_lots[stock_code] = []
        
        lot = PositionLot(
            stock_code=stock_code,
            quantity=quantity,
            buy_date=trade_date,
            buy_price=price,
            is_available=False  # T+0日不可卖
        )
        
        self.position_lots[stock_code].append(lot)
        
        logger.info(
            f"Added buy position: {stock_code} {quantity}@{price:.2f} on {trade_date}"
        )
    
    def process_day_end(self, current_date: date):
        """
        处理日终清算
        
        将T-1日及之前买入的持仓标记为可卖出
        
        Args:
            current_date: 当前日期
        """
        for stock_code, lots in self.position_lots.items():
            for lot in lots:
                # 如果买入日期 < 当前日期，则T+1后可用
                if lot.buy_date < current_date and not lot.is_available:
                    lot.make_available()
                    logger.debug(
                        f"Position available: {stock_code} "
                        f"{lot.quantity} shares from {lot.buy_date}"
                    )
    
    def get_available_quantity(self, stock_code: str) -> int:
        """
        获取可卖出数量
        
        Args:
            stock_code: 股票代码
        
        Returns:
            可卖出数量
        """
        if stock_code not in self.position_lots:
            return 0
        
        return sum(
            lot.quantity for lot in self.position_lots[stock_code]
            if lot.is_available
        )
    
    def get_total_position(self, stock_code: str) -> int:
        """
        获取总持仓数量
        
        Args:
            stock_code: 股票代码
        
        Returns:
            总持仓数量
        """
        if stock_code not in self.position_lots:
            return 0
        
        return sum(lot.quantity for lot in self.position_lots[stock_code])
    
    def can_sell(self, stock_code: str, quantity: int) -> bool:
        """
        检查是否可以卖出指定数量
        
        Args:
            stock_code: 股票代码
            quantity: 卖出数量
        
        Returns:
            是否可以卖出
        """
        available = self.get_available_quantity(stock_code)
        return available >= quantity
    
    def execute_sell(
        self,
        stock_code: str,
        quantity: int,
        price: float,
        sell_date: date
    ) -> Dict:
        """
        执行卖出操作
        
        Args:
            stock_code: 股票代码
            quantity: 卖出数量
            price: 价格
            sell_date: 卖出日期
        
        Returns:
            卖出结果 {success: bool, message: str, profit: float}
        """
        # 检查是否可卖
        if not self.can_sell(stock_code, quantity):
            available = self.get_available_quantity(stock_code)
            return {
                'success': False,
                'message': f'Insufficient available position. Available: {available}, Requested: {quantity}',
                'profit': 0.0
            }
        
        # FIFO原则：先卖出最早的可用持仓
        remaining_qty = quantity
        total_cost = 0.0
        lots_to_remove = []
        
        for lot in self.position_lots.get(stock_code, []):
            if remaining_qty <= 0:
                break
            
            if lot.is_available and lot.quantity > 0:
                # 计算可卖出数量
                sell_from_lot = min(lot.quantity, remaining_qty)
                
                # 累计成本
                total_cost += sell_from_lot * lot.buy_price
                
                # 更新持仓
                lot.quantity -= sell_from_lot
                remaining_qty -= sell_from_lot
                
                # 如果该批次已清空，标记删除
                if lot.quantity == 0:
                    lots_to_remove.append(lot)
        
        # 移除清空的批次
        for lot in lots_to_remove:
            self.position_lots[stock_code].remove(lot)
        
        # 计算盈亏
        proceeds = quantity * price
        profit = proceeds - total_cost
        
        logger.info(
            f"Sell executed: {stock_code} {quantity}@{price:.2f}, "
            f"Profit: {profit:.2f}"
        )
        
        return {
            'success': True,
            'message': 'Sell executed successfully',
            'profit': profit
        }
    
    def get_position_summary(self) -> Dict:
        """
        获取持仓摘要
        
        Returns:
            持仓摘要字典
        """
        summary = {}
        
        for stock_code, lots in self.position_lots.items():
            total_qty = sum(lot.quantity for lot in lots)
            available_qty = sum(
                lot.quantity for lot in lots if lot.is_available
            )
            frozen_qty = total_qty - available_qty
            
            if total_qty > 0:
                avg_cost = sum(
                    lot.quantity * lot.buy_price for lot in lots
                ) / total_qty
            else:
                avg_cost = 0.0
            
            summary[stock_code] = {
                'total_quantity': total_qty,
                'available_quantity': available_qty,
                'frozen_quantity': frozen_qty,
                'avg_cost': avg_cost,
                'lots_count': len([l for l in lots if l.quantity > 0])
            }
        
        return summary
    
    def clear_empty_positions(self):
        """清理空持仓批次"""
        for stock_code in list(self.position_lots.keys()):
            self.position_lots[stock_code] = [
                lot for lot in self.position_lots[stock_code]
                if lot.quantity > 0
            ]
            
            # 如果该股票没有持仓了，删除键
            if not self.position_lots[stock_code]:
                del self.position_lots[stock_code]
