# -*- coding: utf-8 -*-
"""
配对交易管理器 - 订单簿模型

支持一对一、一对多、多对一配对交易
采用价格时间优先撮合引擎
"""

import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from collections import defaultdict

from src.schemas.simulation_models import (
    TradeLeg, TradeGroup, PartialPair, OrderSide, OrderStatus
)

logger = logging.getLogger(__name__)


class OrderBook:
    """
    订单簿
    
    维护买单池和卖单池，支持价格时间优先撮合
    """
    
    def __init__(self, stock_code: str):
        self.stock_code = stock_code
        self.buy_orders: List[TradeLeg] = []  # 买单池
        self.sell_orders: List[TradeLeg] = []  # 卖单池
        self.trade_groups: List[TradeGroup] = []  # 已配对的交易组
    
    def add_order(self, order: TradeLeg):
        """添加订单到订单簿"""
        if order.side == OrderSide.BUY:
            self.buy_orders.append(order)
            # 按价格降序、时间升序排序（高价优先，同价早到优先）
            self.buy_orders.sort(key=lambda x: (-x.price, x.timestamp))
        else:
            self.sell_orders.append(order)
            # 按价格升序、时间升序排序（低价优先，同价早到优先）
            self.sell_orders.sort(key=lambda x: (x.price, x.timestamp))
        
        logger.debug(f"添加订单: {order.side.value} {order.quantity}@{order.price}")
    
    def try_match(self) -> List[Tuple[TradeLeg, TradeLeg, int]]:
        """
        尝试撮合订单
        
        Returns:
            撮合结果列表 [(buy_leg, sell_leg, matched_quantity), ...]
        """
        matches = []
        
        while self.buy_orders and self.sell_orders:
            best_buy = self.buy_orders[0]
            best_sell = self.sell_orders[0]
            
            # 检查价格是否匹配（买入价 >= 卖出价）
            if best_buy.price < best_sell.price:
                break
            
            # 计算可撮合数量
            matched_qty = min(best_buy.quantity, best_sell.quantity)
            
            if matched_qty > 0:
                matches.append((best_buy, best_sell, matched_qty))
                
                # 更新订单数量
                best_buy.quantity -= matched_qty
                best_sell.quantity -= matched_qty
                
                # 移除完全成交的订单
                if best_buy.quantity == 0:
                    self.buy_orders.pop(0)
                if best_sell.quantity == 0:
                    self.sell_orders.pop(0)
        
        return matches
    
    def get_pending_buy_count(self) -> int:
        """获取待成交买单数量"""
        return len(self.buy_orders)
    
    def get_pending_sell_count(self) -> int:
        """获取待成交卖单数量"""
        return len(self.sell_orders)


class FlexiblePairedTradeManager:
    """
    灵活的配对交易管理器
    
    支持：
    - 一对一配对
    - 一对多配对（一笔买入对应多笔卖出）
    - 多对一配对（多笔买入对应一笔卖出）
    - 部分成交处理
    """
    
    def __init__(self, stock_code: str):
        """
        初始化
        
        Args:
            stock_code: 股票代码
        """
        self.stock_code = stock_code
        self.order_book = OrderBook(stock_code)
        self.pending_trades: List[TradeLeg] = []  # 待配对交易池
        self.completed_groups: List[TradeGroup] = []  # 已完成配对的交易组
        self.active_groups: List[TradeGroup] = []  # 进行中的交易组
    
    def add_trade(self, trade: TradeLeg) -> Optional[TradeGroup]:
        """
        添加交易并尝试配对
        
        Args:
            trade: 交易腿
        
        Returns:
            如果形成新配对则返回 TradeGroup，否则返回 None
        """
        logger.info(f"添加交易: {trade.side.value} {trade.quantity}@{trade.price}")
        
        # 添加到订单簿
        self.order_book.add_order(trade)
        self.pending_trades.append(trade)
        
        # 尝试撮合
        matches = self.order_book.try_match()
        
        if not matches:
            logger.info("未找到匹配订单，进入待配对池")
            return None
        
        # 处理撮合结果
        return self._process_matches(matches)
    
    def _process_matches(self, matches: List[Tuple[TradeLeg, TradeLeg, int]]) -> Optional[TradeGroup]:
        """
        处理撮合结果
        
        Args:
            matches: 撮合结果列表
        
        Returns:
            新创建的 TradeGroup 或 None
        """
        if not matches:
            return None
        
        # 创建新的交易组
        group = TradeGroup(stock_code=self.stock_code)
        
        for buy_leg, sell_leg, matched_qty in matches:
            # 创建副本以保留原始数量信息（用于统计）
            from copy import deepcopy
            buy_leg_copy = deepcopy(buy_leg)
            buy_leg_copy.quantity = matched_qty
            sell_leg_copy = deepcopy(sell_leg)
            sell_leg_copy.quantity = matched_qty
            
            # 添加到交易组（使用副本）
            group.buy_legs.append(buy_leg_copy)
            group.sell_legs.append(sell_leg_copy)
            
            # 计算盈亏
            profit = (sell_leg.price - buy_leg.price) * matched_qty
            
            # 创建部分配对记录
            partial_pair = PartialPair(
                buy_leg_id=buy_leg.trade_id,
                sell_leg_id=sell_leg.trade_id,
                matched_quantity=matched_qty,
                profit=profit
            )
            group.partial_pairs.append(partial_pair)
            
            logger.info(
                f"撮合成功: {matched_qty}股 @ 买{buy_leg.price:.2f}/卖{sell_leg.price:.2f}, "
                f"盈亏: {profit:.2f}"
            )
        
        # 检查是否完全配对
        if group.is_complete:
            group.closed_at = datetime.now()
            self.completed_groups.append(group)
            logger.info(f"交易组 {group.group_id[:8]} 完全配对")
        else:
            self.active_groups.append(group)
            logger.info(f"交易组 {group.group_id[:8]} 部分配对")
        
        return group
    
    def force_close(self, reason: str = "强制平仓") -> List[TradeGroup]:
        """
        强制平仓
        
        Args:
            reason: 平仓原因
        
        Returns:
            被强制平仓的交易组列表
        """
        logger.warning(f"强制平仓: {reason}")
        
        closed_groups = []
        
        # 关闭所有活跃的交易组
        for group in self.active_groups:
            group.closed_at = datetime.now()
            group.notes = reason
            closed_groups.append(group)
        
        self.completed_groups.extend(closed_groups)
        self.active_groups.clear()
        
        # 清空订单簿
        self.order_book.buy_orders.clear()
        self.order_book.sell_orders.clear()
        self.pending_trades.clear()
        
        return closed_groups
    
    def get_statistics(self) -> Dict:
        """
        获取统计信息
        
        Returns:
            统计字典
        """
        total_profit = sum(g.total_profit for g in self.completed_groups)
        win_count = sum(1 for g in self.completed_groups if g.total_profit > 0)
        loss_count = sum(1 for g in self.completed_groups if g.total_profit <= 0)
        
        return {
            'stock_code': self.stock_code,
            'pending_trades': len(self.pending_trades),
            'active_groups': len(self.active_groups),
            'completed_groups': len(self.completed_groups),
            'total_profit': total_profit,
            'win_rate': (win_count / len(self.completed_groups) * 100) if self.completed_groups else 0,
            'avg_profit': (total_profit / len(self.completed_groups)) if self.completed_groups else 0
        }
    
    def get_pending_trades(self) -> List[TradeLeg]:
        """获取待配对交易"""
        return self.pending_trades.copy()
    
    def get_active_groups(self) -> List[TradeGroup]:
        """获取活跃交易组"""
        return self.active_groups.copy()
    
    def get_completed_groups(self) -> List[TradeGroup]:
        """获取已完成交易组"""
        return self.completed_groups.copy()
