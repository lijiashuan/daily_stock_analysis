/**
 * 模拟交易 API 客户端
 */

import axios from 'axios';

const API_BASE = '/api/v1/simulation';

// ==================== Types ====================

export interface Account {
  account_id: string;
  account_name: string;
  initial_capital: number;
  available_cash: number;
  total_assets: number;
  profit_loss: number;
  profit_loss_pct: number;
  positions: Record<string, number>;
  trade_count: number;
  created_at: string;
}

export interface CreateAccountRequest {
  account_name: string;
  initial_capital: number;
  trading_mode?: 'conservative' | 'balanced' | 'aggressive';
  strategy_type?: 'grid_trading' | 'intraday_swing' | 'paired_trade';
}

export interface TradeRequest {
  stock_code: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
}

export interface TradeResponse {
  success: boolean;
  order_id: string;
  message: string;
}

export interface GridOrder {
  price: number;
  quantity: number;
  side: string;
  order_type: string;
  notes: string;
}

export interface TradingSuggestion {
  stock_code: string;
  current_price: number;
  predicted_range: [number, number];
  sentiment: string;
  grid_orders: GridOrder[];
  suggestion: string;
}

export interface BacktestResult {
  stock_code: string;
  initial_capital: number;
  final_capital: number;
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  profit_factor: number;
  trade_count: number;
}

// ==================== API Functions ====================

export const simulationApi = {
  // 账户管理
  createAccount: (data: CreateAccountRequest): Promise<Account> =>
    axios.post(`${API_BASE}/accounts`, data).then(res => res.data),

  listAccounts: (): Promise<Account[]> =>
    axios.get(`${API_BASE}/accounts`).then(res => res.data),

  getAccount: (accountId: string): Promise<Account> =>
    axios.get(`${API_BASE}/accounts/${accountId}`).then(res => res.data),

  deleteAccount: (accountId: string): Promise<void> =>
    axios.delete(`${API_BASE}/accounts/${accountId}`).then(() => undefined),

  // 交易执行
  executeTrade: (accountId: string, data: TradeRequest): Promise<TradeResponse> =>
    axios.post(`${API_BASE}/accounts/${accountId}/trade`, data).then(res => res.data),

  // 交易建议
  generateSuggestion: (stockCode: string, useAuction = true): Promise<TradingSuggestion> =>
    axios.post(`${API_BASE}/suggestions`, { stock_code: stockCode, use_auction: useAuction })
      .then(res => res.data),

  // 回测
  runBacktest: (
    stockCode: string,
    startDate: string,
    endDate: string,
    strategyParams?: Record<string, any>
  ): Promise<BacktestResult> =>
    axios.post(`${API_BASE}/backtest`, {
      stock_code: stockCode,
      start_date: startDate,
      end_date: endDate,
      strategy_params: strategyParams
    }).then(res => res.data),

  // 选股
  screenStocks: (minScore = 80, topN = 10): Promise<any[]> =>
    axios.get(`${API_BASE}/stocks/screen`, { params: { min_score: minScore, top_n: topN } })
      .then(res => res.data),

  // 健康检查
  healthCheck: (): Promise<{ status: string }> =>
    axios.get(`${API_BASE}/health`).then(res => res.data),

  // 调度器管理
  startScheduler: (): Promise<{ message: string }> =>
    axios.post(`${API_BASE}/scheduler/start`).then(res => res.data),

  stopScheduler: (): Promise<{ message: string }> =>
    axios.post(`${API_BASE}/scheduler/stop`).then(res => res.data),

  triggerDailySuggestions: (): Promise<{ message: string }> =>
    axios.post(`${API_BASE}/scheduler/daily-suggestions`).then(res => res.data),

  triggerDailyReview: (): Promise<{ message: string }> =>
    axios.post(`${API_BASE}/scheduler/daily-review`).then(res => res.data)
};
