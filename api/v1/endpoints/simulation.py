# -*- coding: utf-8 -*-
"""
===================================
模拟交易 API 路由
===================================

提供模拟交易系统的 RESTful API 接口
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

from src.services.simulation_trading_service import get_simulation_service, SimulationTradingService

router = APIRouter()


# ==================== Pydantic Models ====================

class CreateAccountRequest(BaseModel):
    """创建账户请求"""
    account_name: str = Field(..., description="账户名称", min_length=1, max_length=50)
    initial_capital: float = Field(..., description="初始资金", gt=0)
    trading_mode: str = Field(default="balanced", description="交易模式: conservative/balanced/aggressive")
    strategy_type: str = Field(default="grid_trading", description="策略类型: grid_trading/intraday_swing/paired_trade")


class AccountResponse(BaseModel):
    """账户响应"""
    account_id: str
    account_name: str
    initial_capital: float
    available_cash: float
    total_assets: float
    profit_loss: float
    profit_loss_pct: float
    positions: Dict[str, int]
    trade_count: int
    created_at: str


class TradeRequest(BaseModel):
    """交易请求"""
    stock_code: str = Field(..., description="股票代码")
    side: str = Field(..., description="买卖方向: BUY/SELL")
    price: float = Field(..., description="价格", gt=0)
    quantity: int = Field(..., description="数量", gt=0)


class TradeResponse(BaseModel):
    """交易响应"""
    success: bool
    order_id: str
    message: str


class TradingSuggestionRequest(BaseModel):
    """交易建议请求"""
    stock_code: str = Field(..., description="股票代码")
    use_auction: bool = Field(default=True, description="是否使用集合竞价分析")


class GridOrderResponse(BaseModel):
    """网格订单响应"""
    price: float
    quantity: int
    side: str
    order_type: str
    notes: str


class TradingSuggestionResponse(BaseModel):
    """交易建议响应"""
    stock_code: str
    current_price: float
    predicted_range: List[float]
    sentiment: str
    grid_orders: List[GridOrderResponse]
    suggestion: str


class BacktestRequest(BaseModel):
    """回测请求"""
    stock_code: str = Field(..., description="股票代码")
    start_date: str = Field(..., description="开始日期 YYYYMMDD")
    end_date: str = Field(..., description="结束日期 YYYYMMDD")
    strategy_params: Optional[Dict] = Field(default=None, description="策略参数")


class BacktestResultResponse(BaseModel):
    """回测结果响应"""
    stock_code: str
    initial_capital: float
    final_capital: float
    total_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    win_rate_pct: float
    profit_factor: float
    trade_count: int


# ==================== API Endpoints ====================

@router.post("/accounts", response_model=AccountResponse, tags=["Simulation Trading"])
async def create_account(
    request: CreateAccountRequest,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """
    创建模拟账户
    
    - **account_name**: 账户名称
    - **initial_capital**: 初始资金
    - **trading_mode**: 交易模式（conservative/balanced/aggressive）
    - **strategy_type**: 策略类型
    """
    account = service.create_account(
        account_name=request.account_name,
        initial_capital=request.initial_capital,
        trading_mode=request.trading_mode,
        strategy_type=request.strategy_type
    )
    
    summary = account.get_account_summary()
    
    return AccountResponse(**summary)


@router.get("/accounts", response_model=List[AccountResponse], tags=["Simulation Trading"])
async def list_accounts(service: SimulationTradingService = Depends(get_simulation_service)):
    """获取所有模拟账户列表"""
    accounts = service.list_accounts()
    return [AccountResponse(**acc.get_account_summary()) for acc in accounts]


@router.get("/accounts/{account_id}", response_model=AccountResponse, tags=["Simulation Trading"])
async def get_account(
    account_id: str,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """获取指定账户详情"""
    account = service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return AccountResponse(**account.get_account_summary())


@router.delete("/accounts/{account_id}", tags=["Simulation Trading"])
async def delete_account(
    account_id: str,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """删除模拟账户"""
    success = service.delete_account(account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Account deleted"}


@router.post("/accounts/{account_id}/trade", response_model=TradeResponse, tags=["Simulation Trading"])
async def execute_trade(
    account_id: str,
    request: TradeRequest,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """
    执行模拟交易
    
    - **stock_code**: 股票代码
    - **side**: BUY 或 SELL
    - **price**: 交易价格
    - **quantity**: 交易数量
    """
    result = service.execute_trade(
        account_id=account_id,
        stock_code=request.stock_code,
        side=request.side,
        price=request.price,
        quantity=request.quantity
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return TradeResponse(**result)


@router.post("/suggestions", response_model=TradingSuggestionResponse, tags=["Simulation Trading"])
async def generate_suggestion(
    request: TradingSuggestionRequest,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """
    生成交易建议
    
    基于选股器、集合竞价分析器和日内波段策略生成当日交易建议
    """
    suggestion = service.generate_trading_suggestion(
        stock_code=request.stock_code,
        use_auction=request.use_auction
    )
    
    if "error" in suggestion:
        raise HTTPException(status_code=500, detail=suggestion["error"])
    
    return TradingSuggestionResponse(**suggestion)


@router.post("/backtest", response_model=BacktestResultResponse, tags=["Simulation Trading"])
async def run_backtest(
    request: BacktestRequest,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """
    运行策略回测
    
    - **stock_code**: 股票代码
    - **start_date**: 开始日期（YYYYMMDD）
    - **end_date**: 结束日期（YYYYMMDD）
    - **strategy_params**: 策略参数（可选）
    """
    result = service.run_backtest(
        stock_code=request.stock_code,
        start_date=request.start_date,
        end_date=request.end_date,
        strategy_params=request.strategy_params
    )
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return BacktestResultResponse(**result)


@router.get("/stocks/screen", tags=["Simulation Trading"])
async def screen_stocks(
    min_score: float = 80.0,
    top_n: int = 10,
    service: SimulationTradingService = Depends(get_simulation_service)
):
    """
    筛选优质股票
    
    - **min_score**: 最低评分
    - **top_n**: 返回前N只
    """
    # TODO: 提供股票列表（目前为空）
    stock_list = []  # 应该从配置或数据库获取
    
    if not stock_list:
        return []
    
    results = service.screen_stocks(stock_list, min_score, top_n)
    return results


@router.get("/health", tags=["Simulation Trading"])
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "simulation-trading"}
