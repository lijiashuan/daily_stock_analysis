# -*- coding: utf-8 -*-
"""
集合竞价分析器

分析9:15-9:25的集合竞价数据，预测当日价格区间和走势
"""

import logging
import pandas as pd
import numpy as np
from typing import Dict, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class CallAuctionAnalyzer:
    """
    集合竞价分析器
    
    通过分析集合竞价期间的委托数据，预测：
    1. 当日开盘价
    2. 价格区间（支撑位/阻力位）
    3. 市场情绪（买盘强/卖盘强/平衡）
    """
    
    def __init__(self):
        """初始化分析器"""
        pass
    
    def analyze(
        self,
        auction_data: pd.DataFrame,
        prev_close: float
    ) -> Optional[Dict]:
        """
        分析集合竞价数据
        
        Args:
            auction_data: 集合竞价数据 DataFrame
                列包括：timestamp, match_price, match_volume, buy_unmatched, sell_unmatched
            prev_close: 前一日收盘价
        
        Returns:
            分析结果字典，包含：
            - predicted_open: 预测开盘价
            - price_range: 预测价格区间 (low, high)
            - sentiment: 市场情绪 ('bullish', 'bearish', 'neutral')
            - strength: 情绪强度 (0-1)
            - confidence: 预测置信度 (0-1)
        """
        if auction_data is None or auction_data.empty:
            logger.warning("集合竞价数据为空")
            return None
        
        try:
            # 1. 计算关键指标
            metrics = self._calculate_metrics(auction_data, prev_close)
            
            # 2. 判断市场情绪
            sentiment = self._determine_sentiment(metrics)
            
            # 3. 预测价格区间
            price_range = self._predict_price_range(metrics, prev_close)
            
            # 4. 计算置信度
            confidence = self._calculate_confidence(metrics)
            
            result = {
                'predicted_open': metrics['final_match_price'],
                'price_range': price_range,
                'sentiment': sentiment['type'],
                'sentiment_strength': sentiment['strength'],
                'confidence': confidence,
                'metrics': metrics
            }
            
            logger.info(
                f"集合竞价分析完成: "
                f"预测开盘={result['predicted_open']:.2f}, "
                f"情绪={result['sentiment']}, "
                f"置信度={confidence:.2f}"
            )
            
            return result
        
        except Exception as e:
            logger.error(f"集合竞价分析失败: {e}")
            return None
    
    def _calculate_metrics(self, df: pd.DataFrame, prev_close: float) -> Dict:
        """
        计算集合竞价关键指标
        
        Args:
            df: 集合竞价数据
            prev_close: 前一日收盘价
        
        Returns:
            指标字典
        """
        # 最终撮合价格和成交量
        final_match_price = df['match_price'].iloc[-1]
        final_match_volume = df['match_volume'].iloc[-1]
        
        # 未匹配买卖盘
        final_buy_unmatched = df['buy_unmatched'].iloc[-1]
        final_sell_unmatched = df['sell_unmatched'].iloc[-1]
        
        # 价格变化
        price_change = (final_match_price - prev_close) / prev_close
        
        # 买卖盘力量对比
        buy_sell_ratio = final_buy_unmatched / final_sell_unmatched if final_sell_unmatched > 0 else float('inf')
        
        # 价格趋势（从9:15到9:25的变化）
        if len(df) >= 2:
            first_price = df['match_price'].iloc[0]
            price_trend = (final_match_price - first_price) / first_price
        else:
            price_trend = 0
        
        # 成交量趋势
        if len(df) >= 10:
            early_volume = df['match_volume'].head(5).mean()
            late_volume = df['match_volume'].tail(5).mean()
            volume_trend = (late_volume - early_volume) / early_volume if early_volume > 0 else 0
        else:
            volume_trend = 0
        
        # 价格波动性
        price_volatility = df['match_price'].std() / df['match_price'].mean() if df['match_price'].mean() > 0 else 0
        
        return {
            'final_match_price': final_match_price,
            'final_match_volume': final_match_volume,
            'buy_unmatched': final_buy_unmatched,
            'sell_unmatched': final_sell_unmatched,
            'price_change': price_change,
            'buy_sell_ratio': buy_sell_ratio,
            'price_trend': price_trend,
            'volume_trend': volume_trend,
            'price_volatility': price_volatility,
            'prev_close': prev_close
        }
    
    def _determine_sentiment(self, metrics: Dict) -> Dict:
        """
        判断市场情绪
        
        Args:
            metrics: 指标字典
        
        Returns:
            {'type': 'bullish/bearish/neutral', 'strength': 0-1}
        """
        # 综合多个因素判断情绪
        score = 0.0
        
        # 1. 买卖盘比例（权重40%）
        ratio = metrics['buy_sell_ratio']
        if ratio > 2:
            score += 0.4  # 买盘明显强
        elif ratio > 1.2:
            score += 0.2  # 买盘略强
        elif ratio < 0.5:
            score -= 0.4  # 卖盘明显强
        elif ratio < 0.8:
            score -= 0.2  # 卖盘略强
        
        # 2. 价格变化（权重30%）
        change = metrics['price_change']
        if change > 0.02:
            score += 0.3  # 大幅高开
        elif change > 0:
            score += 0.15  # 小幅高开
        elif change < -0.02:
            score -= 0.3  # 大幅低开
        elif change < 0:
            score -= 0.15  # 小幅低开
        
        # 3. 价格趋势（权重20%）
        trend = metrics['price_trend']
        if trend > 0.01:
            score += 0.2  # 竞价期间上涨
        elif trend < -0.01:
            score -= 0.2  # 竞价期间下跌
        
        # 4. 成交量趋势（权重10%）
        vol_trend = metrics['volume_trend']
        if vol_trend > 0.3:
            score += 0.1  # 放量
        elif vol_trend < -0.3:
            score -= 0.1  # 缩量
        
        # 确定情绪类型和强度
        if score > 0.3:
            sentiment_type = 'bullish'
            strength = min(abs(score), 1.0)
        elif score < -0.3:
            sentiment_type = 'bearish'
            strength = min(abs(score), 1.0)
        else:
            sentiment_type = 'neutral'
            strength = 1.0 - abs(score)
        
        return {
            'type': sentiment_type,
            'strength': round(strength, 2),
            'score': round(score, 2)
        }
    
    def _predict_price_range(self, metrics: Dict, prev_close: float) -> Tuple[float, float]:
        """
        预测当日价格区间
        
        基于：
        1. 集合竞价最终价格
        2. 未匹配买卖盘规模
        3. 历史波动率
        
        Args:
            metrics: 指标字典
            prev_close: 前一日收盘价
        
        Returns:
            (support_level, resistance_level)
        """
        final_price = metrics['final_match_price']
        
        # 基础波动范围（基于价格波动性）
        base_range_pct = max(metrics['price_volatility'] * 2, 0.02)  # 至少2%
        
        # 根据买卖盘不平衡调整
        imbalance = (metrics['buy_unmatched'] - metrics['sell_unmatched']) / \
                   (metrics['buy_unmatched'] + metrics['sell_unmatched']) \
                   if (metrics['buy_unmatched'] + metrics['sell_unmatched']) > 0 else 0
        
        # 向上调整阻力位（买盘强则阻力位更高）
        resistance_adjust = base_range_pct * (1 + imbalance * 0.5)
        resistance = final_price * (1 + resistance_adjust)
        
        # 向下调整支撑位（卖盘强则支撑位更低）
        support_adjust = base_range_pct * (1 - imbalance * 0.5)
        support = final_price * (1 - support_adjust)
        
        return (round(support, 2), round(resistance, 2))
    
    def _calculate_confidence(self, metrics: Dict) -> float:
        """
        计算预测置信度
        
        考虑因素：
        1. 数据完整性
        2. 价格稳定性
        3. 成交量充足性
        
        Args:
            metrics: 指标字典
        
        Returns:
            置信度 (0-1)
        """
        confidence = 1.0
        
        # 1. 价格波动性太高，置信度降低
        if metrics['price_volatility'] > 0.02:
            confidence -= 0.2
        
        # 2. 成交量太小，置信度降低
        if metrics['final_match_volume'] < 10000:
            confidence -= 0.2
        
        # 3. 买卖盘严重不平衡，置信度降低（可能操纵）
        ratio = metrics['buy_sell_ratio']
        if ratio > 10 or ratio < 0.1:
            confidence -= 0.2
        
        # 4. 价格趋势不稳定，置信度降低
        if abs(metrics['price_trend']) > 0.03:
            confidence -= 0.1
        
        return round(max(confidence, 0.0), 2)
    
    def generate_trading_suggestion(
        self,
        analysis_result: Dict,
        current_position: int = 0
    ) -> Dict:
        """
        基于集合竞价分析生成交易建议
        
        Args:
            analysis_result: analyze() 返回的结果
            current_position: 当前持仓数量
        
        Returns:
            交易建议字典
        """
        if not analysis_result:
            return {'action': 'HOLD', 'reason': '无分析数据'}
        
        sentiment = analysis_result['sentiment']
        strength = analysis_result['sentiment_strength']
        predicted_open = analysis_result['predicted_open']
        support, resistance = analysis_result['price_range']
        confidence = analysis_result['confidence']
        
        # 根据情绪和持仓生成建议
        if sentiment == 'bullish' and strength > 0.5:
            if current_position == 0:
                action = 'BUY'
                reason = f"强烈看涨情绪（强度{strength}），建议在{predicted_open:.2f}附近建仓"
            else:
                action = 'HOLD'
                reason = "看涨情绪强烈，持有待涨"
        
        elif sentiment == 'bearish' and strength > 0.5:
            if current_position > 0:
                action = 'SELL'
                reason = f"强烈看跌情绪（强度{strength}），建议在{predicted_open:.2f}附近减仓"
            else:
                action = 'WAIT'
                reason = "看跌情绪强烈，观望为主"
        
        else:
            action = 'OBSERVE'
            reason = f"情绪中性或较弱，观察{support:.2f}-{resistance:.2f}区间突破"
        
        return {
            'action': action,
            'reason': reason,
            'suggested_price': predicted_open,
            'support_level': support,
            'resistance_level': resistance,
            'confidence': confidence
        }
