# -*- coding: utf-8 -*-
"""
股票筛选器

根据多个维度筛选优质股票，用于日内波段交易
"""

import logging
import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class StockScreener:
    """
    股票筛选器
    
    多维度筛选适合日内波段交易的股票
    """
    
    def __init__(self, data_provider):
        """
        初始化
        
        Args:
            data_provider: 数据提供者实例
        """
        self.data_provider = data_provider
    
    def screen_stocks(
        self,
        stock_list: List[str],
        lookback_days: int = 60,
        min_avg_volume: int = 1000000,
        max_volatility: float = 0.05,
        min_volatility: float = 0.01
    ) -> List[Dict]:
        """
        筛选股票
        
        Args:
            stock_list: 待筛选的股票列表
            lookback_days: 回看天数
            min_avg_volume: 最小日均成交量
            max_volatility: 最大波动率（避免过高波动）
            min_volatility: 最小波动率（避免过低波动）
        
        Returns:
            符合条件的股票列表，包含评分和详细信息
        """
        logger.info(f"开始筛选 {len(stock_list)} 只股票...")
        
        candidates = []
        
        for stock_code in stock_list:
            try:
                # 获取历史数据
                end_date = datetime.now().strftime('%Y%m%d')
                start_date = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y%m%d')
                
                df = self.data_provider.get_stock_history(stock_code, start_date, end_date)
                
                if df is None or len(df) < lookback_days * 0.7:  # 至少70%的数据
                    logger.debug(f"{stock_code}: 数据不足，跳过")
                    continue
                
                # 计算各项指标
                metrics = self._calculate_metrics(df)
                
                # 检查是否符合条件
                if not self._meets_criteria(metrics, min_avg_volume, min_volatility, max_volatility):
                    continue
                
                # 计算综合评分
                score = self._calculate_score(metrics)
                
                candidates.append({
                    'stock_code': stock_code,
                    'score': score,
                    'metrics': metrics
                })
                
                logger.debug(f"{stock_code}: 评分 {score:.2f}")
            
            except Exception as e:
                logger.warning(f"{stock_code} 筛选失败: {e}")
                continue
        
        # 按评分排序
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        logger.info(f"筛选完成，找到 {len(candidates)} 只候选股票")
        
        return candidates
    
    def _calculate_metrics(self, df: pd.DataFrame) -> Dict:
        """
        计算股票指标
        
        Args:
            df: 历史数据 DataFrame
        
        Returns:
            指标字典
        """
        close = df['close']
        volume = df['volume']
        
        # 1. 流动性指标
        avg_volume = volume.mean()
        volume_std = volume.std()
        volume_cv = volume_std / avg_volume if avg_volume > 0 else 0  # 变异系数
        
        # 2. 波动率指标
        returns = close.pct_change().dropna()
        daily_volatility = returns.std()
        annualized_volatility = daily_volatility * (252 ** 0.5)
        
        # 3. 趋势指标
        ma20 = close.rolling(20).mean()
        ma60 = close.rolling(60).mean()
        
        # 当前价格相对均线位置
        current_price = close.iloc[-1]
        price_vs_ma20 = (current_price - ma20.iloc[-1]) / ma20.iloc[-1] if ma20.iloc[-1] > 0 else 0
        price_vs_ma60 = (current_price - ma60.iloc[-1]) / ma60.iloc[-1] if ma60.iloc[-1] > 0 else 0
        
        # 4. 振幅指标（适合日内交易）
        high_low_range = (df['high'] - df['low']) / df['close']
        avg_daily_range = high_low_range.mean()
        
        # 5. 成交量趋势
        recent_vol = volume.tail(20).mean()
        previous_vol = volume.head(40).mean() if len(volume) >= 60 else volume.mean()
        volume_trend = (recent_vol - previous_vol) / previous_vol if previous_vol > 0 else 0
        
        return {
            'avg_volume': avg_volume,
            'volume_cv': volume_cv,
            'daily_volatility': daily_volatility,
            'annualized_volatility': annualized_volatility,
            'price_vs_ma20': price_vs_ma20,
            'price_vs_ma60': price_vs_ma60,
            'avg_daily_range': avg_daily_range,
            'volume_trend': volume_trend,
            'current_price': current_price,
            'ma20': ma20.iloc[-1],
            'ma60': ma60.iloc[-1]
        }
    
    def _meets_criteria(
        self,
        metrics: Dict,
        min_avg_volume: int,
        min_volatility: float,
        max_volatility: float
    ) -> bool:
        """
        检查是否符合筛选条件
        
        Args:
            metrics: 指标字典
            min_avg_volume: 最小日均成交量
            min_volatility: 最小波动率
            max_volatility: 最大波动率
        
        Returns:
            是否符合条件
        """
        # 流动性检查
        if metrics['avg_volume'] < min_avg_volume:
            return False
        
        # 波动率检查（不能太高也不能太低）
        if metrics['daily_volatility'] < min_volatility:
            return False
        if metrics['daily_volatility'] > max_volatility:
            return False
        
        # 成交量稳定性（变异系数不能太高）
        if metrics['volume_cv'] > 1.0:
            return False
        
        return True
    
    def _calculate_score(self, metrics: Dict) -> float:
        """
        计算综合评分（0-100）
        
        评分维度：
        - 流动性（30%）：成交量越大越好
        - 波动率（30%）：适中最好（2%-4%）
        - 振幅（20%）：日内空间越大越好
        - 趋势（10%）：温和上涨最好
        - 成交量趋势（10%）：放量最好
        
        Args:
            metrics: 指标字典
        
        Returns:
            评分（0-100）
        """
        score = 0.0
        
        # 1. 流动性评分（30分）
        volume_score = min(metrics['avg_volume'] / 5000000 * 30, 30)  # 500万为满分
        score += volume_score
        
        # 2. 波动率评分（30分）- 适中最好
        vol = metrics['daily_volatility'] * 100  # 转换为百分比
        if 2 <= vol <= 4:
            volatility_score = 30  # 最佳区间
        elif 1 <= vol < 2 or 4 < vol <= 5:
            volatility_score = 20  # 次优区间
        else:
            volatility_score = 10  # 较差
        score += volatility_score
        
        # 3. 振幅评分（20分）
        range_score = min(metrics['avg_daily_range'] * 1000, 20)  # 2%振幅为满分
        score += range_score
        
        # 4. 趋势评分（10分）- 温和上涨最好
        if 0 < metrics['price_vs_ma20'] < 0.1:
            trend_score = 10  # 温和上涨
        elif -0.05 <= metrics['price_vs_ma20'] <= 0:
            trend_score = 8  # 横盘或微跌
        else:
            trend_score = 5  # 极端情况
        score += trend_score
        
        # 5. 成交量趋势（10分）
        if metrics['volume_trend'] > 0.2:
            volume_trend_score = 10  # 明显放量
        elif metrics['volume_trend'] > 0:
            volume_trend_score = 7  # 温和放量
        else:
            volume_trend_score = 5  # 缩量
        score += volume_trend_score
        
        return round(score, 2)
    
    def get_top_stocks(
        self,
        stock_list: List[str],
        top_n: int = 10,
        **kwargs
    ) -> List[Dict]:
        """
        获取评分最高的N只股票
        
        Args:
            stock_list: 待筛选的股票列表
            top_n: 返回前N只
            **kwargs: 传递给 screen_stocks 的参数
        
        Returns:
            前N只股票的列表
        """
        candidates = self.screen_stocks(stock_list, **kwargs)
        return candidates[:top_n]
