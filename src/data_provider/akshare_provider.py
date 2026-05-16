# -*- coding: utf-8 -*-
"""
AkShare 数据提供者

使用 akshare 库获取真实的股票数据
"""

import pandas as pd
from datetime import datetime
from typing import Optional, Dict
from src.data_provider.base import DataProvider


class AkShareDataProvider(DataProvider):
    """
    AkShare 数据提供者
    
    通过 akshare 库获取 A 股、港股、美股数据
    """
    
    def __init__(self):
        """初始化 AkShare 数据提供者"""
        try:
            import akshare as ak
            self.ak = ak
            self._available = True
        except ImportError:
            print("警告: akshare 未安装，AkShareDataProvider 不可用")
            self._available = False
    
    def get_stock_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        frequency: str = 'daily'
    ) -> Optional[pd.DataFrame]:
        """
        从 AkShare 获取历史数据
        
        Args:
            stock_code: 股票代码（如 '600519', '000001'）
            start_date: 开始日期（格式 'YYYYMMDD'）
            end_date: 结束日期（格式 'YYYYMMDD'）
            frequency: 数据频率（目前只支持 'daily'）
        
        Returns:
            DataFrame with OHLCV data
        """
        if not self._available:
            return None
        
        try:
            # 标准化日期格式
            if '-' in start_date:
                start_date = start_date.replace('-', '')
            if '-' in end_date:
                end_date = end_date.replace('-', '')
            
            # 根据股票代码判断市场
            if stock_code.startswith('hk') or stock_code.startswith('HK'):
                # 港股
                df = self._get_hk_history(stock_code, start_date, end_date)
            elif stock_code.isalpha():
                # 美股
                df = self._get_us_history(stock_code, start_date, end_date)
            else:
                # A股
                df = self._get_a_share_history(stock_code, start_date, end_date)
            
            if df is None or df.empty:
                return None
            
            # 标准化列名
            df = self._standardize_columns(df)
            
            # 设置索引
            if 'date' in df.columns:
                df.set_index('date', inplace=True)
                df.index = pd.to_datetime(df.index)
            
            return df
        
        except Exception as e:
            print(f"AkShareDataProvider 错误: {e}")
            return None
    
    def get_realtime_quote(self, stock_code: str) -> Optional[Dict]:
        """获取实时行情"""
        if not self._available:
            return None
        
        try:
            # A股实时行情
            if not stock_code.isalpha() and not stock_code.startswith('hk'):
                df = self.ak.stock_zh_a_spot_em()
                
                # 过滤目标股票
                if stock_code.startswith('sh') or stock_code.startswith('sz'):
                    symbol = stock_code[2:]
                else:
                    symbol = stock_code
                
                row = df[df['代码'] == symbol]
                
                if row.empty:
                    return None
                
                row = row.iloc[0]
                
                return {
                    'price': float(row['最新价']),
                    'change': float(row['涨跌额']),
                    'change_pct': float(row['涨跌幅']),
                    'volume': int(row['成交量']) if '成交量' in row else 0,
                    'timestamp': datetime.now().isoformat(),
                    'stock_code': stock_code
                }
            
            return None
        
        except Exception as e:
            print(f"AkShareDataProvider 实时行情错误: {e}")
            return None
    
    def get_call_auction_data(
        self,
        stock_code: str,
        date: str
    ) -> Optional[pd.DataFrame]:
        """
        获取集合竞价数据
        
        Note: AkShare 目前不直接提供集合竞价明细数据
        返回 None 表示不支持
        """
        # TODO: 未来可以考虑从其他数据源获取
        return None
    
    def is_available(self) -> bool:
        """检查 AkShare 是否可用"""
        if not self._available:
            return False
        
        try:
            # 尝试获取一个简单的数据来测试连接
            df = self.ak.stock_zh_a_spot_em()
            return df is not None and not df.empty
        except:
            return False
    
    def get_source_name(self) -> str:
        """返回数据源名称"""
        return "AkShare"
    
    def _get_a_share_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str
    ) -> Optional[pd.DataFrame]:
        """获取A股历史数据"""
        try:
            # 去除市场前缀
            if stock_code.startswith('sh') or stock_code.startswith('sz'):
                symbol = stock_code[2:]
            else:
                symbol = stock_code
            
            # 使用东财接口
            df = self.ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start_date,
                end_date=end_date,
                adjust="qfq"  # 前复权
            )
            
            return df
        
        except Exception as e:
            print(f"获取A股数据失败: {e}")
            return None
    
    def _get_hk_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str
    ) -> Optional[pd.DataFrame]:
        """获取港股历史数据"""
        try:
            # 去除 'hk' 前缀
            symbol = stock_code.lower().replace('hk', '')
            
            df = self.ak.stock_hk_hist(
                symbol=symbol,
                period="daily",
                start_date=start_date,
                end_date=end_date,
                adjust=""
            )
            
            return df
        
        except Exception as e:
            print(f"获取港股数据失败: {e}")
            return None
    
    def _get_us_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str
    ) -> Optional[pd.DataFrame]:
        """获取美股历史数据"""
        try:
            # 转换日期格式为 YYYY-MM-DD
            start_date_fmt = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:]}"
            end_date_fmt = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:]}"
            
            df = self.ak.stock_us_hist(
                symbol=stock_code.lower(),
                start_date=start_date_fmt,
                end_date=end_date_fmt,
                adjust="qfq"
            )
            
            return df
        
        except Exception as e:
            print(f"获取美股数据失败: {e}")
            return None
    
    def _standardize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        标准化列名
        
        不同市场的列名可能不同，统一为标准格式
        """
        column_mapping = {
            # 东财接口常见列名
            '开盘': 'open',
            '最高': 'high',
            '最低': 'low',
            '收盘': 'close',
            '成交量': 'volume',
            '成交额': 'amount',
            '日期': 'date',
            
            # 其他可能的列名
            'open': 'open',
            'high': 'high',
            'low': 'low',
            'close': 'close',
            'volume': 'volume',
            'amount': 'amount',
            'Date': 'date',
        }
        
        # 重命名列
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        # 确保必要的列存在
        required_cols = ['open', 'high', 'low', 'close', 'volume']
        for col in required_cols:
            if col not in df.columns:
                print(f"警告: 缺少必要列 {col}")
                return None
        
        return df
