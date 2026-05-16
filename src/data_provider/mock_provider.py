# -*- coding: utf-8 -*-
"""
模拟数据提供者

生成模拟的股票数据，用于开发和测试阶段
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict
from src.data_provider.base import DataProvider


class MockDataProvider(DataProvider):
    """
    模拟数据提供者
    
    生成随机但合理的股票数据，不依赖网络
    """
    
    def __init__(self, seed: int = 42):
        """
        初始化
        
        Args:
            seed: 随机种子，保证可复现性
        """
        self.seed = seed
        self.rng = np.random.default_rng(seed)
    
    def get_stock_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        frequency: str = 'daily'
    ) -> Optional[pd.DataFrame]:
        """生成模拟历史数据"""
        try:
            # 解析日期
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date.replace('-', ''), '%Y%m%d')
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date.replace('-', ''), '%Y%m%d')
            
            # 生成日期范围
            date_range = pd.date_range(start=start_date, end=end_date, freq='D')
            
            # 过滤工作日（A股）
            date_range = date_range[date_range.dayofweek < 5]
            
            n_days = len(date_range)
            if n_days == 0:
                return None
            
            # 生成价格序列（随机游走 + 趋势）
            base_price = self.rng.uniform(10, 100)
            trend = self.rng.normal(0, 0.001, n_days).cumsum()
            noise = self.rng.normal(0, 0.02, n_days)
            
            close_prices = base_price * (1 + trend + noise)
            close_prices = np.maximum(close_prices, 1)  # 价格不低于1
            
            # 生成 OHLCV
            data = []
            for i in range(n_days):
                close = close_prices[i]
                
                # 日内波动
                daily_range = close * self.rng.uniform(0.01, 0.05)
                
                high = close + self.rng.uniform(0, daily_range)
                low = close - self.rng.uniform(0, daily_range)
                open_price = low + self.rng.uniform(0, high - low)
                
                volume = int(self.rng.uniform(1e6, 1e7))
                amount = volume * close
                
                data.append({
                    'open': round(open_price, 2),
                    'high': round(high, 2),
                    'low': round(low, 2),
                    'close': round(close, 2),
                    'volume': volume,
                    'amount': round(amount, 2)
                })
            
            df = pd.DataFrame(data, index=date_range)
            df.index.name = 'date'
            
            return df
        
        except Exception as e:
            print(f"MockDataProvider 错误: {e}")
            return None
    
    def get_realtime_quote(self, stock_code: str) -> Optional[Dict]:
        """生成模拟实时行情"""
        try:
            base_price = self.rng.uniform(10, 100)
            change = self.rng.normal(0, base_price * 0.02)
            
            return {
                'price': round(base_price, 2),
                'change': round(change, 2),
                'change_pct': round(change / base_price * 100, 2),
                'volume': int(self.rng.uniform(1e6, 1e7)),
                'timestamp': datetime.now().isoformat(),
                'stock_code': stock_code
            }
        
        except Exception as e:
            print(f"MockDataProvider 实时行情错误: {e}")
            return None
    
    def get_call_auction_data(
        self,
        stock_code: str,
        date: str
    ) -> Optional[pd.DataFrame]:
        """生成模拟集合竞价数据"""
        try:
            # 生成 9:15-9:25 的竞价数据
            timestamps = []
            base_time = datetime.strptime(date, '%Y-%m-%d').replace(hour=9, minute=15)
            
            for minute in range(10):
                for second in [0, 30]:
                    ts = base_time + timedelta(minutes=minute, seconds=second)
                    if ts.hour == 9 and ts.minute >= 25:
                        break
                    timestamps.append(ts)
            
            # 生成竞价数据
            base_price = self.rng.uniform(10, 100)
            data = []
            
            for ts in timestamps:
                # 价格逐渐收敛
                time_factor = (ts - timestamps[0]).total_seconds() / 600
                price = base_price * (1 + self.rng.normal(0, 0.01 * (1 - time_factor)))
                
                data.append({
                    'timestamp': ts.isoformat(),
                    'match_price': round(price, 2),
                    'match_volume': int(self.rng.uniform(10000, 100000)),
                    'buy_unmatched': int(self.rng.uniform(50000, 500000)),
                    'sell_unmatched': int(self.rng.uniform(50000, 500000))
                })
            
            df = pd.DataFrame(data)
            return df
        
        except Exception as e:
            print(f"MockDataProvider 集合竞价错误: {e}")
            return None
    
    def is_available(self) -> bool:
        """Mock 数据源始终可用"""
        return True
    
    def get_source_name(self) -> str:
        """返回数据源名称"""
        return "MockDataProvider"
