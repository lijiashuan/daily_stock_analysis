# -*- coding: utf-8 -*-
"""
模拟交易服务

整合数据提供者、策略算法和账户管理，提供统一的业务逻辑接口
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta

from src.data_provider.base import DataProvider
from src.data_provider.mock_provider import MockDataProvider
from src.schemas.simulation_models import SimulationAccount, TradingMode, StrategyType
from src.strategies.stock_screener import StockScreener
from src.strategies.call_auction_analyzer import CallAuctionAnalyzer
from src.strategies.intraday_swing_strategy import IntradaySwingStrategy
from src.strategies.simple_backtester import SimpleBacktester

logger = logging.getLogger(__name__)


class SimulationTradingService:
    """
    模拟交易服务
    
    核心业务逻辑层，整合所有组件
    """
    
    def __init__(self, data_provider: Optional[DataProvider] = None):
        """
        初始化服务
        
        Args:
            data_provider: 数据提供者（默认使用Mock）
        """
        self.data_provider = data_provider or MockDataProvider()
        self.accounts: Dict[str, SimulationAccount] = {}
        
        # 初始化策略组件
        self.screener = StockScreener(self.data_provider)
        self.auction_analyzer = CallAuctionAnalyzer()
        self.backtester = SimpleBacktester()
        
        logger.info("SimulationTradingService 初始化完成")
    
    # ==================== 账户管理 ====================
    
    def create_account(
        self,
        account_name: str,
        initial_capital: float,
        trading_mode: str = "balanced",
        strategy_type: str = "grid_trading"
    ) -> SimulationAccount:
        """
        创建模拟账户
        
        Args:
            account_name: 账户名称
            initial_capital: 初始资金
            trading_mode: 交易模式
            strategy_type: 策略类型
        
        Returns:
            创建的账户实例
        """
        # 转换枚举
        mode_map = {
            "conservative": TradingMode.CONSERVATIVE,
            "balanced": TradingMode.BALANCED,
            "aggressive": TradingMode.AGGRESSIVE
        }
        
        strategy_map = {
            "grid_trading": StrategyType.GRID_TRADING,
            "intraday_swing": StrategyType.INTRADAY_SWING,
            "paired_trade": StrategyType.PAIRED_TRADE
        }
        
        account = SimulationAccount(
            _account_name=account_name,
            _initial_capital=initial_capital,
            _cash=initial_capital,
            trading_mode=mode_map.get(trading_mode, TradingMode.BALANCED),
            strategy_type=strategy_map.get(strategy_type, StrategyType.GRID_TRADING)
        )
        
        self.accounts[account.account_id] = account
        
        logger.info(f"创建账户: {account_name}, ID: {account.account_id}")
        
        return account
    
    def get_account(self, account_id: str) -> Optional[SimulationAccount]:
        """获取账户"""
        return self.accounts.get(account_id)
    
    def list_accounts(self) -> List[SimulationAccount]:
        """列出所有账户"""
        return list(self.accounts.values())
    
    def delete_account(self, account_id: str) -> bool:
        """删除账户"""
        if account_id in self.accounts:
            del self.accounts[account_id]
            logger.info(f"删除账户: {account_id}")
            return True
        return False
    
    # ==================== 交易执行 ====================
    
    def execute_trade(
        self,
        account_id: str,
        stock_code: str,
        side: str,
        price: float,
        quantity: int
    ) -> Dict:
        """
        执行交易
        
        Args:
            account_id: 账户ID
            stock_code: 股票代码
            side: BUY 或 SELL
            price: 价格
            quantity: 数量
        
        Returns:
            交易结果
        """
        logger.info(f"执行交易: account_id={account_id}, stock_code={stock_code}, side={side}, price={price}, quantity={quantity}")
        
        account = self.get_account(account_id)
        if not account:
            logger.warning(f"账户不存在: {account_id}")
            return {"success": False, "message": "账户不存在"}
        
        logger.info(f"账户当前资金: {account.available_cash}, 持仓: {account.positions}")
        
        from src.schemas.simulation_models import OrderRequest, OrderSide
        
        order = OrderRequest(
            stock_code=stock_code,
            side=OrderSide.BUY if side == "BUY" else OrderSide.SELL,
            price=price,
            quantity=quantity
        )
        
        result = account.place_order(order)
        
        logger.info(f"交易结果: success={result.success}, message={result.message}")
        
        return {
            "success": result.success,
            "order_id": result.order_id,
            "message": result.message
        }
    
    # ==================== 交易建议 ====================
    
    def generate_trading_suggestion(
        self,
        stock_code: str,
        account_id: Optional[str] = None,
        use_auction: bool = True
    ) -> Dict:
        """
        生成交易建议
        
        Args:
            stock_code: 股票代码
            account_id: 账户ID（可选，用于获取当前持仓）
            use_auction: 是否使用集合竞价分析
        
        Returns:
            交易建议字典
        """
        # 1. 获取历史数据
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=90)).strftime('%Y%m%d')
        
        historical_data = self.data_provider.get_stock_history(stock_code, start_date, end_date)
        
        if historical_data is None:
            return {"error": "无法获取历史数据"}
        
        current_price = historical_data['close'].iloc[-1]
        
        # 2. 获取当前持仓
        current_position = 0
        if account_id:
            account = self.get_account(account_id)
            if account:
                current_position = account.positions.get(stock_code, 0)
        
        # 3. 集合竞价分析（可选）
        auction_prediction = None
        if use_auction:
            today = datetime.now().strftime('%Y-%m-%d')
            auction_data = self.data_provider.get_call_auction_data(stock_code, today)
            
            if auction_data is not None:
                prev_close = historical_data['close'].iloc[-2] if len(historical_data) > 1 else current_price
                auction_prediction = self.auction_analyzer.analyze(auction_data, prev_close)
        
        # 4. 生成网格订单
        available_cash = 100000.0  # TODO: 从账户获取
        if account_id:
            account = self.get_account(account_id)
            if account:
                available_cash = account.available_cash
        
        strategy = IntradaySwingStrategy()
        grid_orders = strategy.generate_orders(
            historical_data=historical_data,
            current_price=current_price,
            available_cash=available_cash,
            current_position=current_position,
            auction_prediction=auction_prediction
        )
        
        # 5. 组装建议
        suggestion = {
            "stock_code": stock_code,
            "current_price": current_price,
            "predicted_range": [current_price * 0.98, current_price * 1.02],  # TODO: 实际预测
            "sentiment": "neutral",  # TODO: 从集合竞价获取
            "grid_orders": [
                {
                    "price": order.price,
                    "quantity": order.quantity,
                    "side": order.side,
                    "order_type": order.order_type,
                    "notes": order.notes
                }
                for order in grid_orders
            ],
            "suggestion": f"基于当前价格{current_price:.2f}生成{len(grid_orders)}个网格订单"
        }
        
        return suggestion
    
    # ==================== 回测 ====================
    
    def run_backtest(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        strategy_params: Optional[Dict] = None
    ) -> Dict:
        """
        运行回测
        
        Args:
            stock_code: 股票代码
            start_date: 开始日期（YYYYMMDD）
            end_date: 结束日期（YYYYMMDD）
            strategy_params: 策略参数
        
        Returns:
            回测结果
        """
        # 1. 获取历史数据
        historical_data = self.data_provider.get_stock_history(stock_code, start_date, end_date)
        
        if historical_data is None:
            return {"error": "无法获取历史数据"}
        
        # 2. 创建简单策略用于测试
        class TestStrategy:
            def __init__(self):
                self.name = "TestStrategy"
            
            def generate_signals(self, df):
                signals = []
                
                # 简单的均线交叉策略
                ma_short = df['close'].rolling(5).mean()
                ma_long = df['close'].rolling(20).mean()
                
                for i in range(20, len(df)):
                    date = df.index[i]
                    
                    # 金叉买入
                    if ma_short.iloc[i] > ma_long.iloc[i] and ma_short.iloc[i-1] <= ma_long.iloc[i-1]:
                        signals.append({
                            'timestamp': date,
                            'action': 'BUY',
                            'price': df['close'].iloc[i],
                            'quantity': 100,
                            'confidence': 0.7,
                            'reason': '金叉信号'
                        })
                    
                    # 死叉卖出
                    elif ma_short.iloc[i] < ma_long.iloc[i] and ma_short.iloc[i-1] >= ma_long.iloc[i-1]:
                        signals.append({
                            'timestamp': date,
                            'action': 'SELL',
                            'price': df['close'].iloc[i],
                            'quantity': 100,
                            'confidence': 0.7,
                            'reason': '死叉信号'
                        })
                
                return signals
            
            def get_params(self):
                return {}
            
            def set_params(self, params):
                pass
        
        strategy = TestStrategy()
        
        # 3. 运行回测
        result = self.backtester.run(strategy, historical_data, stock_code)
        
        return result
    
    # ==================== 选股 ====================
    
    def screen_stocks(
        self,
        stock_list: List[str],
        min_score: float = 80.0,
        top_n: int = 10
    ) -> List[Dict]:
        """
        筛选股票
        
        Args:
            stock_list: 待筛选的股票列表
            min_score: 最低评分
            top_n: 返回前N只
        
        Returns:
            符合条件的股票列表
        """
        candidates = self.screener.screen_stocks(stock_list)
        
        # 过滤最低评分
        filtered = [c for c in candidates if c['score'] >= min_score]
        
        # 返回前N只
        return filtered[:top_n]


# 全局服务实例（单例模式）
_simulation_service: Optional[SimulationTradingService] = None


def get_simulation_service() -> SimulationTradingService:
    """获取模拟交易服务实例（依赖注入）"""
    global _simulation_service
    
    if _simulation_service is None:
        _simulation_service = SimulationTradingService()
    
    return _simulation_service
