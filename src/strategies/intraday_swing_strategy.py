# -*- coding: utf-8 -*-
"""
日内波段策略

基于ATR、布林带等技术指标，生成高抛低吸的网格订单
"""

import logging
import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GridOrder:
    """网格订单"""
    price: float
    quantity: int
    side: str  # 'BUY' or 'SELL'
    order_type: str  # 'ENTRY', 'TAKE_PROFIT', 'STOP_LOSS'
    notes: str = ""


class IntradaySwingStrategy:
    """
    日内波段策略
    
    结合多种技术指标预测当日高低点，生成网格交易订单
    """
    
    def __init__(
        self,
        grid_levels: int = 5,
        position_pct: float = 0.6,
        atr_multiplier: float = 1.5,
        bollinger_std: float = 2.0
    ):
        """
        初始化策略
        
        Args:
            grid_levels: 网格层数
            position_pct: 仓位比例（0-1）
            atr_multiplier: ATR倍数（用于止损止盈）
            bollinger_std: 布林带标准差倍数
        """
        self.grid_levels = grid_levels
        self.position_pct = position_pct
        self.atr_multiplier = atr_multiplier
        self.bollinger_std = bollinger_std
    
    def generate_orders(
        self,
        historical_data: pd.DataFrame,
        current_price: float,
        available_cash: float,
        current_position: int = 0,
        auction_prediction: Optional[Dict] = None
    ) -> List[GridOrder]:
        """
        生成网格订单
        
        Args:
            historical_data: 历史数据 DataFrame
            current_price: 当前价格
            available_cash: 可用资金
            current_position: 当前持仓
            auction_prediction: 集合竞价预测结果（可选）
        
        Returns:
            网格订单列表
        """
        logger.info(f"生成网格订单: 当前价={current_price:.2f}, 持仓={current_position}")
        
        # 1. 计算技术指标
        indicators = self._calculate_indicators(historical_data)
        
        # 2. 预测当日区间
        predicted_range = self._predict_daily_range(
            indicators, current_price, auction_prediction
        )
        
        # 3. 生成网格
        orders = self._generate_grid(
            predicted_range, current_price, available_cash, current_position
        )
        
        logger.info(f"生成 {len(orders)} 个网格订单")
        
        return orders
    
    def _calculate_indicators(self, df: pd.DataFrame) -> Dict:
        """
        计算技术指标
        
        Args:
            df: 历史数据
        
        Returns:
            指标字典
        """
        close = df['close']
        high = df['high']
        low = df['low']
        
        # 1. ATR（平均真实波幅）
        tr = self._calculate_true_range(high, low, close)
        atr = tr.rolling(14).mean().iloc[-1]
        
        # 2. 布林带
        ma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        upper_band = ma20 + self.bollinger_std * std20
        lower_band = ma20 - self.bollinger_std * std20
        
        # 3. RSI
        rsi = self._calculate_rsi(close, period=14)
        
        # 4. 成交量均线
        volume_ma20 = df['volume'].rolling(20).mean()
        
        return {
            'atr': atr,
            'ma20': ma20.iloc[-1],
            'upper_band': upper_band.iloc[-1],
            'lower_band': lower_band.iloc[-1],
            'rsi': rsi.iloc[-1],
            'volume_ma20': volume_ma20.iloc[-1],
            'current_volume': df['volume'].iloc[-1]
        }
    
    def _calculate_true_range(
        self,
        high: pd.Series,
        low: pd.Series,
        close: pd.Series
    ) -> pd.Series:
        """计算真实波幅"""
        prev_close = close.shift(1)
        
        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        return tr
    
    def _calculate_rsi(self, close: pd.Series, period: int = 14) -> pd.Series:
        """计算RSI"""
        delta = close.diff()
        
        gain = delta.where(delta > 0, 0).rolling(period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def _predict_daily_range(
        self,
        indicators: Dict,
        current_price: float,
        auction_prediction: Optional[Dict] = None
    ) -> Tuple[float, float]:
        """
        预测当日价格区间
        
        综合多种方法：
        1. ATR-based range
        2. Bollinger Bands
        3. Auction prediction（如果有）
        
        Args:
            indicators: 技术指标
            current_price: 当前价格
            auction_prediction: 集合竞价预测
        
        Returns:
            (predicted_low, predicted_high)
        """
        atr = indicators['atr']
        upper_band = indicators['upper_band']
        lower_band = indicators['lower_band']
        
        # 方法1: ATR预测区间
        atr_high = current_price + self.atr_multiplier * atr
        atr_low = current_price - self.atr_multiplier * atr
        
        # 方法2: 布林带区间
        bb_high = upper_band
        bb_low = lower_band
        
        # 综合两种方法（取交集）
        predicted_high = min(atr_high, bb_high)
        predicted_low = max(atr_low, bb_low)
        
        # 如果有集合竞价预测，进一步调整
        if auction_prediction:
            auction_low, auction_high = auction_prediction.get('price_range', (predicted_low, predicted_high))
            
            # 加权平均
            weight_auction = auction_prediction.get('confidence', 0.5)
            weight_technical = 1 - weight_auction
            
            predicted_high = (
                predicted_high * weight_technical + 
                auction_high * weight_auction
            )
            predicted_low = (
                predicted_low * weight_technical + 
                auction_low * weight_auction
            )
        
        return (round(predicted_low, 2), round(predicted_high, 2))
    
    def _generate_grid(
        self,
        predicted_range: Tuple[float, float],
        current_price: float,
        available_cash: float,
        current_position: int
    ) -> List[GridOrder]:
        """
        生成网格订单
        
        在预测区间内均匀分布买卖订单
        
        Args:
            predicted_range: (low, high)
            current_price: 当前价格
            available_cash: 可用资金
            current_position: 当前持仓
        
        Returns:
            订单列表
        """
        low, high = predicted_range
        orders = []
        
        # 计算网格间距
        range_size = high - low
        if range_size <= 0:
            logger.warning("预测区间无效")
            return []
        
        grid_spacing = range_size / (self.grid_levels + 1)
        
        # 计算每层交易量
        base_quantity = self._calculate_position_size(
            available_cash, current_price, current_position
        )
        
        # 生成买入网格（从低到高）
        for i in range(1, self.grid_levels + 1):
            buy_price = low + i * grid_spacing
            
            if buy_price < current_price:  # 只在当前价下方挂买单
                quantity = base_quantity
                
                orders.append(GridOrder(
                    price=round(buy_price, 2),
                    quantity=quantity,
                    side='BUY',
                    order_type='ENTRY',
                    notes=f'网格买入层{i}'
                ))
        
        # 生成卖出网格（从高到低）
        for i in range(1, self.grid_levels + 1):
            sell_price = high - i * grid_spacing
            
            if sell_price > current_price:  # 只在当前价上方挂卖单
                quantity = base_quantity
                
                orders.append(GridOrder(
                    price=round(sell_price, 2),
                    quantity=quantity,
                    side='SELL',
                    order_type='TAKE_PROFIT',
                    notes=f'网格卖出层{i}'
                ))
        
        # 添加止损单（如果有持仓）
        if current_position > 0:
            stop_loss_price = low * 0.98  # 支撑位下方2%
            
            orders.append(GridOrder(
                price=round(stop_loss_price, 2),
                quantity=current_position,
                side='SELL',
                order_type='STOP_LOSS',
                notes='止损单'
            ))
        
        # 按价格排序
        orders.sort(key=lambda x: x.price)
        
        return orders
    
    def _calculate_position_size(
        self,
        available_cash: float,
        current_price: float,
        current_position: int
    ) -> int:
        """
        计算每层交易数量
        
        Args:
            available_cash: 可用资金
            current_price: 当前价格
            current_position: 当前持仓
        
        Returns:
            每层交易数量（股）
        """
        # 总可用资金中用于网格交易的部分
        grid_capital = available_cash * self.position_pct
        
        # 分配到每个网格层
        capital_per_level = grid_capital / (self.grid_levels * 2)  # 买卖各grid_levels层
        
        # 计算股数（向下取整到100的倍数，A股要求）
        quantity = int(capital_per_level / current_price / 100) * 100
        
        # 至少100股
        return max(quantity, 100)
    
    def adjust_orders_based_on_rsi(
        self,
        orders: List[GridOrder],
        rsi: float
    ) -> List[GridOrder]:
        """
        根据RSI调整订单
        
        RSI超买时减少买单，超卖时减少卖单
        
        Args:
            orders: 原始订单列表
            rsi: RSI值
        
        Returns:
            调整后的订单列表
        """
        adjusted_orders = orders.copy()
        
        if rsi > 70:  # 超买
            # 移除部分买单
            buy_orders = [o for o in adjusted_orders if o.side == 'BUY']
            if len(buy_orders) > 2:
                # 只保留最低的2个买单
                buy_orders.sort(key=lambda x: x.price)
                to_remove = buy_orders[2:]
                for order in to_remove:
                    adjusted_orders.remove(order)
                
                logger.info(f"RSI超买({rsi:.1f})，移除{len(to_remove)}个买单")
        
        elif rsi < 30:  # 超卖
            # 移除部分卖单
            sell_orders = [o for o in adjusted_orders if o.side == 'SELL']
            if len(sell_orders) > 2:
                # 只保留最高的2个卖单
                sell_orders.sort(key=lambda x: x.price, reverse=True)
                to_remove = sell_orders[2:]
                for order in to_remove:
                    adjusted_orders.remove(order)
                
                logger.info(f"RSI超卖({rsi:.1f})，移除{len(to_remove)}个卖单")
        
        return adjusted_orders
