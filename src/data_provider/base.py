# -*- coding: utf-8 -*-
"""
数据提供者抽象基类

定义统一的数据获取接口，支持多种数据源实现
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict
import pandas as pd
from datetime import datetime


class DataProvider(ABC):
    """
    数据提供者抽象基类
    
    所有数据源实现都必须继承此类并实现抽象方法
    """
    
    @abstractmethod
    def get_stock_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        frequency: str = 'daily'
    ) -> Optional[pd.DataFrame]:
        """
        获取股票历史数据
        
        Args:
            stock_code: 股票代码（如 '600519', 'AAPL'）
            start_date: 开始日期（格式 'YYYYMMDD' 或 'YYYY-MM-DD'）
            end_date: 结束日期（格式 'YYYYMMDD' 或 'YYYY-MM-DD'）
            frequency: 数据频率 ('daily', 'weekly', 'monthly')
        
        Returns:
            DataFrame，包含 OHLCV 数据，索引为日期
            列包括：open, high, low, close, volume, amount（可选）
            失败返回 None
        """
        pass
    
    @abstractmethod
    def get_realtime_quote(self, stock_code: str) -> Optional[Dict]:
        """
        获取实时行情
        
        Args:
            stock_code: 股票代码
        
        Returns:
            字典，包含：price, change, change_pct, volume, timestamp
            失败返回 None
        """
        pass
    
    @abstractmethod
    def get_call_auction_data(
        self,
        stock_code: str,
        date: str
    ) -> Optional[pd.DataFrame]:
        """
        获取集合竞价数据
        
        Args:
            stock_code: 股票代码
            date: 日期（格式 'YYYY-MM-DD'）
        
        Returns:
            DataFrame，包含竞价期间的委托数据
            列包括：timestamp, match_price, match_volume, buy_unmatched, sell_unmatched
            失败返回 None（或不支持时返回 None）
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        检查数据源是否可用
        
        Returns:
            True 如果数据源可用，False 否则
        """
        pass
    
    @abstractmethod
    def get_source_name(self) -> str:
        """
        获取数据源名称
        
        Returns:
            数据源名称字符串
        """
        pass


class DataCache:
    """
    数据缓存管理器
    
    使用 SQLite 缓存历史数据，避免重复网络请求
    """
    
    def __init__(self, cache_dir: str = "data/cache"):
        import os
        from sqlalchemy import create_engine
        
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        # SQLite 数据库路径
        self.db_path = os.path.join(cache_dir, "stock_data_cache.db")
        self.engine = create_engine(f"sqlite:///{self.db_path}")
        
        # 初始化表
        self._init_tables()
    
    def _init_tables(self):
        """初始化缓存表"""
        from sqlalchemy import text
        
        with self.engine.connect() as conn:
            # 历史数据缓存表
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS history_cache (
                    stock_code TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT NOT NULL,
                    frequency TEXT NOT NULL DEFAULT 'daily',
                    data_json TEXT NOT NULL,
                    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (stock_code, start_date, end_date, frequency)
                )
            """))
            
            # 实时行情缓存表（短期缓存）
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS realtime_cache (
                    stock_code TEXT NOT NULL PRIMARY KEY,
                    data_json TEXT NOT NULL,
                    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            conn.commit()
    
    def get_history_cache(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        frequency: str = 'daily',
        max_age_hours: int = 24
    ) -> Optional[pd.DataFrame]:
        """
        从缓存获取历史数据
        
        Args:
            stock_code: 股票代码
            start_date: 开始日期
            end_date: 结束日期
            frequency: 数据频率
            max_age_hours: 缓存最大有效期（小时）
        
        Returns:
            DataFrame 或 None（缓存不存在或过期）
        """
        from sqlalchemy import text
        import json
        
        with self.engine.connect() as conn:
            result = conn.execute(text("""
                SELECT data_json, cached_at 
                FROM history_cache 
                WHERE stock_code = :stock_code 
                  AND start_date = :start_date 
                  AND end_date = :end_date 
                  AND frequency = :frequency
                  AND cached_at >= datetime('now', :max_age)
            """), {
                'stock_code': stock_code,
                'start_date': start_date,
                'end_date': end_date,
                'frequency': frequency,
                'max_age': f'-{max_age_hours} hours'
            }).fetchone()
            
            if result:
                try:
                    data_dict = json.loads(result[0])
                    df = pd.DataFrame(data_dict['data'])
                    df.index = pd.to_datetime(df.index)
                    return df
                except Exception as e:
                    print(f"缓存数据解析失败: {e}")
                    return None
            
            return None
    
    def save_history_cache(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        frequency: str,
        df: pd.DataFrame
    ):
        """
        保存历史数据到缓存
        
        Args:
            stock_code: 股票代码
            start_date: 开始日期
            end_date: 结束日期
            frequency: 数据频率
            df: 数据 DataFrame
        """
        from sqlalchemy import text
        import json
        
        # 转换为可序列化的格式
        data_dict = {
            'data': df.to_dict('list'),
            'index': df.index.tolist()
        }
        
        with self.engine.connect() as conn:
            conn.execute(text("""
                INSERT OR REPLACE INTO history_cache 
                (stock_code, start_date, end_date, frequency, data_json, cached_at)
                VALUES (:stock_code, :start_date, :end_date, :frequency, :data_json, CURRENT_TIMESTAMP)
            """), {
                'stock_code': stock_code,
                'start_date': start_date,
                'end_date': end_date,
                'frequency': frequency,
                'data_json': json.dumps(data_dict, default=str)
            })
            conn.commit()
    
    def get_realtime_cache(
        self,
        stock_code: str,
        max_age_seconds: int = 60
    ) -> Optional[Dict]:
        """
        从缓存获取实时行情
        
        Args:
            stock_code: 股票代码
            max_age_seconds: 缓存最大有效期（秒）
        
        Returns:
            行情字典或 None
        """
        from sqlalchemy import text
        import json
        
        with self.engine.connect() as conn:
            result = conn.execute(text("""
                SELECT data_json 
                FROM realtime_cache 
                WHERE stock_code = :stock_code 
                  AND cached_at >= datetime('now', :max_age)
            """), {
                'stock_code': stock_code,
                'max_age': f'-{max_age_seconds} seconds'
            }).fetchone()
            
            if result:
                try:
                    return json.loads(result[0])
                except:
                    return None
            
            return None
    
    def save_realtime_cache(self, stock_code: str, data: Dict):
        """保存实时行情到缓存"""
        from sqlalchemy import text
        import json
        
        with self.engine.connect() as conn:
            conn.execute(text("""
                INSERT OR REPLACE INTO realtime_cache 
                (stock_code, data_json, cached_at)
                VALUES (:stock_code, :data_json, CURRENT_TIMESTAMP)
            """), {
                'stock_code': stock_code,
                'data_json': json.dumps(data, default=str)
            })
            conn.commit()
    
    def clear_expired_cache(self, history_max_days: int = 30, realtime_max_hours: int = 1):
        """清理过期缓存"""
        from sqlalchemy import text
        
        with self.engine.connect() as conn:
            # 清理过期的历史数据
            conn.execute(text("""
                DELETE FROM history_cache 
                WHERE cached_at < datetime('now', :max_age)
            """), {'max_age': f'-{history_max_days} days'})
            
            # 清理过期的实时数据
            conn.execute(text("""
                DELETE FROM realtime_cache 
                WHERE cached_at < datetime('now', :max_age)
            """), {'max_age': f'-{realtime_max_hours} hours'})
            
            conn.commit()
