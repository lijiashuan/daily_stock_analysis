# -*- coding: utf-8 -*-
"""
策略基类

定义统一的策略接口，确保所有策略可以被回测引擎直接调用
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import pandas as pd


class BaseStrategy(ABC):
    """
    策略基类
    
    所有策略必须实现此接口
    """
    
    def __init__(self, name: str, params: Optional[Dict] = None):
        """
        初始化策略
        
        Args:
            name: 策略名称
            params: 策略参数字典
        """
        self.name = name
        self.params = params or {}
    
    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> List[Dict]:
        """
        生成交易信号
        
        Args:
            df: 历史数据 DataFrame（包含 OHLCV）
        
        Returns:
            信号列表，每个信号包含：
            - timestamp: 信号时间
            - action: 'BUY' / 'SELL' / 'HOLD'
            - price: 建议价格
            - quantity: 建议数量
            - confidence: 置信度 (0-1)
            - reason: 信号原因说明
        """
        pass
    
    @abstractmethod
    def get_params(self) -> Dict:
        """
        获取策略参数
        
        Returns:
            参数字典
        """
        pass
    
    @abstractmethod
    def set_params(self, params: Dict):
        """
        设置策略参数
        
        Args:
            params: 新参数字典
        """
        pass
    
    def validate_params(self, params: Dict) -> bool:
        """
        验证参数合法性
        
        Args:
            params: 待验证的参数
        
        Returns:
            是否合法
        """
        # 默认实现：总是合法
        # 子类可以重写此方法
        return True
    
    def get_strategy_info(self) -> Dict:
        """
        获取策略信息
        
        Returns:
            策略信息字典
        """
        return {
            'name': self.name,
            'params': self.get_params(),
            'description': self.__doc__ or ''
        }
