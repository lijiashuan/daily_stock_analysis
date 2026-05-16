# -*- coding: utf-8 -*-
"""
模拟交易系统数据模型

包含账户、交易、配对等核心数据结构
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime
import uuid


class TradingMode(Enum):
    """交易模式枚举"""
    CONSERVATIVE = "conservative"  # 保守型：小仓位，多网格
    BALANCED = "balanced"          # 平衡型：中等仓位
    AGGRESSIVE = "aggressive"      # 激进型：大仓位，少网格


class StrategyType(Enum):
    """策略类型枚举"""
    GRID_TRADING = "grid_trading"           # 网格交易
    INTRADAY_SWING = "intraday_swing"       # 日内波段
    PAIRED_TRADE = "paired_trade"           # 配对交易


class OrderSide(Enum):
    """订单方向"""
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(Enum):
    """订单状态"""
    PENDING = "PENDING"         # 待成交
    FILLED = "FILLED"           # 已成交
    CANCELLED = "CANCELLED"     # 已取消
    PARTIAL_FILLED = "PARTIAL_FILLED"  # 部分成交


@dataclass
class TradeLeg:
    """
    交易腿（单笔交易）
    
    表示一笔买入或卖出操作
    """
    trade_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    stock_code: str = ""
    side: OrderSide = OrderSide.BUY
    price: float = 0.0
    quantity: int = 0
    timestamp: datetime = field(default_factory=datetime.now)
    status: OrderStatus = OrderStatus.PENDING
    commission: float = 0.0  # 手续费
    notes: str = ""  # 备注
    
    @property
    def amount(self) -> float:
        """交易金额"""
        return self.price * self.quantity
    
    @property
    def total_cost(self) -> float:
        """总成本（含手续费）"""
        return self.amount + self.commission


@dataclass
class PartialPair:
    """
    部分配对记录
    
    用于支持一对多/多对一配对场景
    """
    buy_leg_id: str = ""
    sell_leg_id: str = ""
    matched_quantity: int = 0  # 已配对数量
    profit: float = 0.0  # 该部分配对的盈亏
    paired_at: datetime = field(default_factory=datetime.now)


@dataclass
class TradeGroup:
    """
    交易组 - 支持一对一、一对多、多对一配对
    
    一个完整的配对交易可能包含多个买入和卖出腿
    """
    group_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    stock_code: str = ""
    buy_legs: List[TradeLeg] = field(default_factory=list)
    sell_legs: List[TradeLeg] = field(default_factory=list)
    partial_pairs: List[PartialPair] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    closed_at: Optional[datetime] = None
    
    @property
    def total_buy_quantity(self) -> int:
        """总买入数量"""
        return sum(leg.quantity for leg in self.buy_legs)
    
    @property
    def total_sell_quantity(self) -> int:
        """总卖出数量"""
        return sum(leg.quantity for leg in self.sell_legs)
    
    @property
    def avg_buy_price(self) -> float:
        """平均买入价格"""
        if not self.buy_legs:
            return 0.0
        total_amount = sum(leg.amount for leg in self.buy_legs)
        total_qty = self.total_buy_quantity
        return total_amount / total_qty if total_qty > 0 else 0.0
    
    @property
    def avg_sell_price(self) -> float:
        """平均卖出价格"""
        if not self.sell_legs:
            return 0.0
        total_amount = sum(leg.amount for leg in self.sell_legs)
        total_qty = self.total_sell_quantity
        return total_amount / total_qty if total_qty > 0 else 0.0
    
    @property
    def total_profit(self) -> float:
        """总盈亏"""
        if self.partial_pairs:
            return sum(p.profit for p in self.partial_pairs)
        
        # 如果没有部分配对记录，简单计算
        buy_amount = sum(leg.amount for leg in self.buy_legs)
        sell_amount = sum(leg.amount for leg in self.sell_legs)
        return sell_amount - buy_amount
    
    @property
    def is_complete(self) -> bool:
        """是否完全配对"""
        return self.total_buy_quantity == self.total_sell_quantity and self.total_buy_quantity > 0
    
    @property
    def profit_pct(self) -> float:
        """盈亏百分比"""
        buy_amount = sum(leg.amount for leg in self.buy_legs)
        if buy_amount == 0:
            return 0.0
        return (self.total_profit / buy_amount) * 100


class BaseAccount(ABC):
    """
    账户抽象基类
    
    模拟账户和真实券商账户的共同接口
    """
    
    @property
    @abstractmethod
    def account_id(self) -> str:
        """账户ID"""
        pass
    
    @property
    @abstractmethod
    def account_name(self) -> str:
        """账户名称"""
        pass
    
    @property
    @abstractmethod
    def initial_capital(self) -> float:
        """初始资金"""
        pass
    
    @property
    @abstractmethod
    def available_cash(self) -> float:
        """可用资金"""
        pass
    
    @property
    @abstractmethod
    def positions(self) -> Dict[str, int]:
        """持仓字典 {stock_code: quantity}"""
        pass
    
    @abstractmethod
    def place_order(self, order: 'OrderRequest') -> 'OrderResult':
        """
        下单
        
        Args:
            order: 订单请求
        
        Returns:
            订单结果
        """
        pass
    
    @abstractmethod
    def cancel_order(self, order_id: str) -> bool:
        """
        撤单
        
        Args:
            order_id: 订单ID
        
        Returns:
            是否成功
        """
        pass
    
    @abstractmethod
    def get_account_summary(self) -> Dict:
        """
        获取账户摘要
        
        Returns:
            账户信息字典
        """
        pass


@dataclass
class SimulationAccount(BaseAccount):
    """
    模拟账户实现
    
    用于模拟交易的虚拟账户
    """
    _account_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    _account_name: str = "模拟账户"
    _initial_capital: float = 100000.0
    _cash: float = 100000.0
    _positions: Dict[str, int] = field(default_factory=dict)
    _trades: List[TradeLeg] = field(default_factory=list)
    _trade_groups: List[TradeGroup] = field(default_factory=list)
    trading_mode: TradingMode = TradingMode.BALANCED
    strategy_type: StrategyType = StrategyType.GRID_TRADING
    created_at: datetime = field(default_factory=datetime.now)
    
    @property
    def account_id(self) -> str:
        return self._account_id
    
    @property
    def account_name(self) -> str:
        return self._account_name
    
    @property
    def initial_capital(self) -> float:
        return self._initial_capital
    
    @property
    def available_cash(self) -> float:
        return self._cash
    
    @property
    def positions(self) -> Dict[str, int]:
        return self._positions.copy()
    
    def place_order(self, order: 'OrderRequest') -> 'OrderResult':
        """模拟下单"""
        from src.schemas.simulation_models import OrderResult
        
        # 检查资金是否充足
        if order.side == OrderSide.BUY:
            required_cash = order.price * order.quantity
            if required_cash > self._cash:
                return OrderResult(
                    success=False,
                    message=f"资金不足：需要 {required_cash:.2f}，可用 {self._cash:.2f}"
                )
            
            # 扣减资金
            self._cash -= required_cash
            
            # 增加持仓
            current_qty = self._positions.get(order.stock_code, 0)
            self._positions[order.stock_code] = current_qty + order.quantity
        
        elif order.side == OrderSide.SELL:
            # 检查持仓是否足够
            current_qty = self._positions.get(order.stock_code, 0)
            if current_qty < order.quantity:
                return OrderResult(
                    success=False,
                    message=f"持仓不足：需要 {order.quantity}，持有 {current_qty}"
                )
            
            # 增加资金
            self._cash += order.price * order.quantity
            
            # 减少持仓
            self._positions[order.stock_code] = current_qty - order.quantity
            if self._positions[order.stock_code] == 0:
                del self._positions[order.stock_code]
        
        # 记录交易
        trade = TradeLeg(
            stock_code=order.stock_code,
            side=order.side,
            price=order.price,
            quantity=order.quantity,
            status=OrderStatus.FILLED
        )
        self._trades.append(trade)
        
        return OrderResult(
            success=True,
            order_id=trade.trade_id,
            message="订单成交"
        )
    
    def cancel_order(self, order_id: str) -> bool:
        """模拟撤单（简化实现）"""
        # TODO: 实现真实的撤单逻辑
        return True
    
    def get_account_summary(self) -> Dict:
        """获取账户摘要"""
        total_assets = self._cash + sum(
            qty * 100 for qty in self._positions.values()  # 简化：假设股价100
        )
        
        return {
            'account_id': self.account_id,
            'account_name': self.account_name,
            'initial_capital': self.initial_capital,
            'available_cash': self.available_cash,
            'total_assets': total_assets,
            'profit_loss': total_assets - self.initial_capital,
            'profit_loss_pct': ((total_assets - self.initial_capital) / self.initial_capital) * 100,
            'positions': self.positions,
            'trade_count': len(self._trades),
            'created_at': self.created_at.isoformat()
        }


@dataclass
class OrderRequest:
    """订单请求"""
    stock_code: str
    side: OrderSide
    price: float
    quantity: int


@dataclass
class OrderResult:
    """订单结果"""
    success: bool
    order_id: str = ""
    message: str = ""
