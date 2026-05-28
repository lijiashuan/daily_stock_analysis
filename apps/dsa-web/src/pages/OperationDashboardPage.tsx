import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Bell, CheckCircle2, Clock, Eye, FileJson, RefreshCw, Target, Trash2, Loader2, X } from 'lucide-react';
import { cn } from '../utils/cn';

// Types for v2.0 format
interface MarketIndex {
  close: number;
  change_pct: number;
  trend: string;
}

interface MarketIndexes {
  shanghai: MarketIndex;
  chi_next50: MarketIndex;
  shanghai50: MarketIndex;
}

interface OrderTrigger {
  id: string;
  type: string;
  value: number;
}

interface Order {
  id: string;
  stock_code: string;
  stock_name: string;
  direction: 'buy' | 'sell';
  order_type: string;
  quantity: number;
  price: number;
  trigger: OrderTrigger;
  priority: number;
  validity: string;
  reason: string;
}

interface Position {
  stock_code: string;
  stock_name: string;
  shares: number;
  avg_cost: number;
  last_price: number;
  day_change_pct: number;
  unrealized_pnl: number;
  weight_pct: number;
  score: number;
  ma_status: string;
  stop_loss: number;
  action: 'hold' | 'add' | 'reduce' | 'sell';
  note: string;
}

interface ExecutionLogEntry {
  time: string;
  action: string;
  stock: string;
  qty: number | string;
  price?: number;
  note: string;
}

// Auto Watch types (v2.0/v2.1)
interface AutoWatchTrigger {
  type: string;
  target?: number;
  value?: number;
  source?: string;
  volume_ratio_threshold?: number;
  price_above?: number;
  confirm_bars?: number;
  logic_note?: string; // v2.1: 逻辑说明
}

interface AutoWatchCondition {
  reject_if?: {
    volume_ratio_below?: number;
    market_depth_sell_wall_gte?: number;
    price_drop_to?: number;
    logic_note?: string; // v2.1: 否决条件说明
  };
  cancel_if?: {
    price_gap_open_above?: number;
    time_passed?: string;
    logic_note?: string; // v2.1: 撤销条件说明
  };
}

interface AutoWatchExecution {
  mode: 'auto_limit' | 'auto_market' | 'notify_only';
  limit_price_offset?: number;
  validity: string;
  retry_on_fail?: boolean;
  max_retries?: number;
}

interface AutoWatch {
  id: string;
  stock_code: string;
  stock_name: string;
  direction: 'buy' | 'sell' | 'none';
  quantity: number;
  max_price?: number;
  min_price?: number;
  trigger: AutoWatchTrigger;
  reject_if?: AutoWatchCondition['reject_if']; // v2.1: 平铺字段
  cancel_if?: AutoWatchCondition['cancel_if']; // v2.1: 平铺字段
  condition?: AutoWatchCondition; // v2.0: 嵌套字段（向后兼容）
  execution: AutoWatchExecution;
  priority: number;
  reason: string;
}

interface WatchRules {
  scan_interval_seconds: number;
  notify_on_execute: boolean;
  notify_on_reject: boolean;
  notify_on_cancel: boolean;
  fail_safe?: {
    auto_watch_disable_if_cash_below?: number;
    max_concurrent_watches?: number;
  };
}

interface LogicFlow {
  version: string;
  description: string;
  trigger: string;
  reject_if: string;
  cancel_if: string;
}

interface DashboardDataV2 {
  dashboard_version: string;
  generated_at?: string;
  trade_date?: string;
  note?: string;
  logic_flow?: LogicFlow; // v2.1: 逻辑流程说明
  summary: {
    total_assets: number;
    cash: number;
    cash_ratio_pct: number;
    stock_value: number;
    unrealized_pnl: number;
    indexes: MarketIndexes;
    sector_wind?: { // v2.1: 板块风向
      top: string[];
      note: string;
    };
  };
  orders: Order[];
  positions: Position[];
  execution_log?: ExecutionLogEntry[];
  auto_watch?: AutoWatch[];
  watch_rules?: WatchRules;
}

// Legacy types for v1.0 format (keep for backward compatibility)
interface MarketIndexLegacy {
  close: number;
  change_pct: number;
  note: string;
}

interface MarketContext {
  shanghai_composite?: MarketIndexLegacy;
  shenzhen_component?: MarketIndexLegacy;
  chi_next_50?: MarketIndexLegacy;
  shanghai_50?: MarketIndexLegacy;
  [key: string]: MarketIndexLegacy | undefined;
}

interface MustDoItem {
  priority: number;
  stock_code: string;
  stock_name: string;
  action: 'buy' | 'sell';
  quantity: number;
  price_range?: { min: number; max: number };
  stop_loss?: number | null;
  reason: string;
  note: string;
}

interface ConditionalItem {
  priority: number;
  stock_code: string;
  stock_name: string;
  action: 'buy' | 'sell';
  quantity: number;
  trigger: string;
  stop_loss: number;
  reason: string;
  target_position?: number;
}

interface HoldItem {
  stock_code: string;
  stock_name: string;
  shares: number;
  avg_cost: number;
  current_price: number;
  change_pct?: number;
  unrealized_pnl: number;
  weight_pct: number;
  trend_score: number;
  trend_status: string;
  stop_loss?: number | null;
  note: string;
}

interface WatchPriceItem {
  name: string;
  operation?: string;
  watch_price: number;
  note: string;
}

interface DashboardDataV1 {
  dashboard_version: string;
  generated_at?: string;
  date: string;
  time?: string;
  updated_holdings?: {
    note: string;
  };
  summary?: {
    total_assets: number;
    cash: number;
    cash_ratio_pct: number;
    total_market_value: number;
    unrealized_pnl: number;
    market_context: MarketContext;
  };
  must_do: MustDoItem[];
  conditional: ConditionalItem[];
  hold: HoldItem[];
  watch_prices?: Record<string, WatchPriceItem>;
  watch_prices_afternoon?: Record<string, WatchPriceItem>;
  overall_assessment?: {
    today_performance?: string;
    major_risk?: string;
    cash_remaining?: string;
    afternoon_summary?: string;
  };
  execution_notes?: string[];
}

// Union type supporting both versions
type DashboardData = DashboardDataV1 | DashboardDataV2;

// Type guard for v2.0/v2.1 format
const isDashboardV2 = (data: DashboardData): data is DashboardDataV2 => {
  return data.dashboard_version === '2.0' || data.dashboard_version === '2.1' || 'orders' in data;
};

interface ExecutionLog {
  id: string;
  stock_code: string;
  stock_name: string;
  action: 'buy' | 'sell';
  quantity: number;
  executed_price?: number;
  executed_at: string;
  note?: string;
}

interface PushStatus {
  [stockCode: string]: {
    pushed: boolean;
    pushedAt?: string;
  };
}

const STORAGE_KEY = 'operation_dashboard_data';
const PUSH_STATUS_KEY = 'operation_dashboard_push_status';

const OperationDashboardPage: React.FC = () => {
  const [rawInput, setRawInput] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [sendingAlert, setSendingAlert] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>({});
  const [autoMonitorEnabled, setAutoMonitorEnabled] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState<{ enabled: boolean; rule_count: number; check_count: number; trigger_count: number; push_success_count: number; push_fail_count: number; last_check_time: string | null } | null>(null);
  const [isV2, setIsV2] = useState(false); // Track JSON format version

  // Load monitor status on mount
  useEffect(() => {
    loadMonitorStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      const savedPushStatus = localStorage.getItem(PUSH_STATUS_KEY);
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setDashboardData(parsed);
        setRawInput(JSON.stringify(parsed, null, 2));
        
        // Detect format version
        const v2Format = isDashboardV2(parsed);
        setIsV2(v2Format);
        
        // Load today's execution logs from backend trade history
        if (v2Format) {
          const v2Data = parsed as DashboardDataV2;
          loadTodayExecutionLogs(v2Data.trade_date);
        } else {
          loadTodayExecutionLogs();
        }
      }
      
      if (savedPushStatus) {
        setPushStatus(JSON.parse(savedPushStatus));
      }
    } catch (err) {
      console.error('Failed to load saved dashboard data:', err);
    }
  }, []);

  // Save data to localStorage when dashboardData changes
  useEffect(() => {
    if (dashboardData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboardData));
    }
  }, [dashboardData]);

  // Save push status to localStorage
  useEffect(() => {
    localStorage.setItem(PUSH_STATUS_KEY, JSON.stringify(pushStatus));
  }, [pushStatus]);

  // Load monitor status from backend
  const loadMonitorStatus = async () => {
    try {
      const res = await fetch('/api/v1/agent/monitor/status');
      if (res.ok) {
        const data = await res.json();
        setMonitorStatus(data);
        setAutoMonitorEnabled(data.enabled);
      }
    } catch (err) {
      console.error('Failed to load monitor status:', err);
    }
  };

  // Load today's execution logs from backend trade history
  const loadTodayExecutionLogs = async (tradeDate?: string) => {
    try {
      const url = tradeDate 
        ? `/api/v1/portfolio/trades/today?date=${tradeDate}` 
        : '/api/v1/portfolio/trades/today';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const trades = data.items || [];
        
        // Convert trade records to execution logs
        const logs: ExecutionLog[] = trades.map((trade: any) => ({
          id: `trade_${trade.id}`,
          stock_code: trade.symbol,
          stock_name: '', // Will be populated if needed
          action: trade.side as 'buy' | 'sell',
          quantity: trade.quantity,
          executed_price: trade.price,
          executed_at: trade.trade_date.includes('T') 
            ? trade.trade_date.split('T')[1].substring(0, 5) 
            : 'N/A',
          note: trade.note || undefined,
        }));
        
        setExecutionLogs(logs);
      }
    } catch (err) {
      console.error('Failed to load execution logs:', err);
    }
  };

  // Load rules to backend when dashboard data changes
  useEffect(() => {
    if (isV2) {
      // v2.0: Load auto_watch rules
      const v2Data = dashboardData as DashboardDataV2;
      const autoWatch = v2Data?.auto_watch;
      if (autoWatch && autoWatch.length > 0) {
        loadRulesV2ToBackend(autoWatch);
      }
    } else {
      // v1.0: Load watch_prices rules
      const v1Data = dashboardData as DashboardDataV1;
      const watchPrices = v1Data?.watch_prices || v1Data?.watch_prices_afternoon;
      if (watchPrices && Object.keys(watchPrices).length > 0) {
        loadRulesToBackend(watchPrices);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData, isV2]);

  const loadRulesToBackend = async (watchPrices?: Record<string, WatchPriceItem>) => {
    // Only v1.0 has watch_prices
    if (isV2) return;
    
    const v1Data = dashboardData as DashboardDataV1;
    const prices = watchPrices || v1Data?.watch_prices || v1Data?.watch_prices_afternoon;
    if (!prices) return;
    try {
      await fetch('/api/v1/agent/monitor/load-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watch_prices: prices }),
      });
      // Don't call loadMonitorStatus here to avoid race condition
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  // Load rules to backend (v2.0 format)
  const loadRulesV2ToBackend = async (autoWatch?: AutoWatch[]) => {
    if (!isV2) return;
    
    const v2Data = dashboardData as DashboardDataV2;
    const rules = autoWatch || v2Data?.auto_watch;
    if (!rules || rules.length === 0) return;
    try {
      await fetch('/api/v1/agent/monitor/load-rules-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_watch: rules }),
      });
      // Don't call loadMonitorStatus here to avoid race condition
    } catch (err) {
      console.error('Failed to load v2 rules:', err);
    }
  };

  // Toast notification helper
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sample data for testing
  const sampleData: DashboardData = {
    "dashboard_version": "1.0",
    "generated_at": "2026-05-18 收盘后",
    "date": "2026-05-19",
    "summary": {
      "total_assets": 492651,
      "cash": 99943,
      "cash_ratio_pct": 20.3,
      "total_market_value": 392708,
      "unrealized_pnl": -11334,
      "market_context": {
        "shanghai_composite": {
          "close": 4131.53,
          "change_pct": -0.09,
          "note": "平盘震荡"
        },
        "shenzhen_component": {
          "close": 15530.23,
          "change_pct": -0.20,
          "note": "微跌"
        },
        "chi_next_50": {
          "close": 1709.96,
          "change_pct": 0.81,
          "note": "科技主线维持强势"
        },
        "shanghai_50": {
          "close": 2934.96,
          "change_pct": -0.77,
          "note": "大盘蓝筹承压，消费板块回调"
        }
      }
    },
    "must_do": [
      {
        "priority": 1,
        "stock_code": "002544",
        "stock_name": "普天科技",
        "action": "sell",
        "quantity": 500,
        "price_range": {
          "min": 25.8,
          "max": 26.2
        },
        "stop_loss": null,
        "reason": "纠正昨日操作失误（原计划清仓，手滑多买500股，现1,000股降回500股）",
        "note": "趋势评分39分，空头排列，MA5<MA10<MA20，MACD死叉，量比0.73无量反弹。纠错操作，见价即走"
      }
    ],
    "conditional": [
      {
        "priority": 2,
        "stock_code": "000333",
        "stock_name": "美的集团",
        "action": "buy",
        "quantity": 400,
        "trigger": "回踩82.0~82.5区间",
        "stop_loss": 80.0,
        "reason": "补仓至满配800股（约6.6万）。趋势评分67，多头排列MA5>MA10>MA20，今日+0.31%收82.83。唯一瑕疵RSI(6)=83.84超买，等回踩82附近再补更安全",
        "target_position": 800
      }
    ],
    "hold": [
      {
        "stock_code": "600887",
        "stock_name": "伊利股份",
        "shares": 3500,
        "avg_cost": 27.60,
        "current_price": 27.29,
        "unrealized_pnl": -1098,
        "weight_pct": 19.4,
        "trend_score": 69,
        "trend_status": "多头排列",
        "stop_loss": 26.50,
        "note": "今日-1.16%属食品板块系统性回调（板块-2.37%），量比0.67缩量回调是洗盘特征。MA20(26.59)距当前+2.6%空间安全。中线PE=14.28倍估值偏低，持有不动"
      },
      {
        "stock_code": "002158",
        "stock_name": "汉钟精机",
        "shares": 1000,
        "avg_cost": 31.97,
        "current_price": 31.85,
        "unrealized_pnl": -123,
        "weight_pct": 6.5,
        "trend_score": 77,
        "trend_status": "强多头排列",
        "stop_loss": 30.50,
        "note": "全场趋势评分最高77分。今日-3.78%回踩MA10(31.79)获支撑，收盘31.85刚好在MA10上方。MACD多头柱线仍在放大，RSI(6)=53.23强势区。正常技术回踩，持有不动"
      },
      {
        "stock_code": "600900",
        "stock_name": "长江电力",
        "shares": 4300,
        "avg_cost": 26.74,
        "current_price": 26.89,
        "unrealized_pnl": 627,
        "weight_pct": 23.4,
        "trend_score": 51,
        "trend_status": "弱势空头",
        "stop_loss": 26.60,
        "note": "已跌破MA20(26.91)多头生命线，趋势走弱。已是你最大仓位23.4%，不加仓。关注26.6前低支撑，若跌破考虑减仓1,000股降风险。今日主力净流出-2.94亿"
      },
      {
        "stock_code": "600797",
        "stock_name": "浙大网新",
        "shares": 4000,
        "avg_cost": 9.12,
        "current_price": 9.04,
        "unrealized_pnl": -310,
        "weight_pct": 7.3,
        "trend_score": 37,
        "trend_status": "空头排列",
        "stop_loss": null,
        "note": "空头排列MA5<MA10<MA20，量比仅0.52极度缩量无资金关注。已按计划减仓2,300股@9.00（满分操作），剩余4,000股持有观察到6月中旬"
      },
      {
        "stock_code": "603169",
        "stock_name": "兰石重装",
        "shares": 4600,
        "avg_cost": 10.47,
        "current_price": 8.69,
        "unrealized_pnl": -8176,
        "weight_pct": 8.1,
        "trend_score": 55,
        "trend_status": "弱势多头",
        "stop_loss": null,
        "note": "MACD柱线翻红(0.136)，有金叉迹象。量比0.76缩量下跌非恐慌抛售。持有观察，若反弹至9.0~9.1可减仓1,000股降低成本"
      },
      {
        "stock_code": "601933",
        "stock_name": "永辉超市",
        "shares": 4000,
        "avg_cost": 4.24,
        "current_price": 3.63,
        "unrealized_pnl": -2433,
        "weight_pct": 2.9,
        "trend_score": 51,
        "trend_status": "空头排列",
        "stop_loss": null,
        "note": "RSI(6)=20.83全场最超卖，技术上随时可能反弹。量比0.54极度缩量阴跌但无恐慌。按你意愿坚决不动，等反弹"
      }
    ],
    "watch_prices": {
      "002544": {
        "name": "普天科技",
        "operation": "卖出500股",
        "watch_price": 25.80,
        "note": "竞价或开盘后25.8~26.2卖出纠错"
      },
      "000333": {
        "name": "美的集团",
        "operation": "买入400股补仓",
        "watch_price": 82.50,
        "note": "回踩82.0~82.5触发买入"
      },
      "600887": {
        "name": "伊利股份",
        "watch_price": 27.00,
        "note": "关注27.0整数关口支撑"
      },
      "002158": {
        "name": "汉钟精机",
        "watch_price": 31.50,
        "note": "MA10(31.79)附近支撑观察"
      },
      "600900": {
        "name": "长江电力",
        "watch_price": 26.60,
        "note": "前低支撑，跌破考虑减仓"
      },
      "603169": {
        "name": "兰石重装",
        "watch_price": 9.00,
        "note": "反弹至9.0以上可减仓1,000"
      }
    },
    "execution_notes": [
      "开盘前复制本JSON到DSA看板组件渲染",
      "每完成一项操作，在前端标记✅并记录执行价格",
      "盘中盯 watch_prices 价格预警，触发时执行对应操作",
      "收盘后反馈执行结果给我，我生成下一日看板"
    ]
  };

  const handleParse = () => {
    try {
      setError(null);
      const parsed = JSON.parse(rawInput);
      setDashboardData(parsed);
      
      // Detect format version
      const v2Format = isDashboardV2(parsed);
      setIsV2(v2Format);
      
      // For v2.0, load execution_log from JSON
      if (v2Format && 'execution_log' in parsed && Array.isArray(parsed.execution_log)) {
        const logs: ExecutionLog[] = (parsed as DashboardDataV2).execution_log!.map((log, idx) => ({
          id: `exec_${idx}`,
          stock_code: '', // Will be populated if needed
          stock_name: log.stock,
          action: log.action === 'cancel' ? 'sell' : (log.action as 'buy' | 'sell'),
          quantity: typeof log.qty === 'number' ? log.qty : 0,
          executed_price: log.price,
          executed_at: log.time.split(' ')[1] || log.time,
          note: log.note,
        }));
        setExecutionLogs(logs);
      } else {
        // For v1.0 or no execution_log, reset
        setExecutionLogs([]);
      }
      
      setPushStatus({});
      showToast('success', `数据解析成功！${v2Format ? '(v2.0格式)' : '(v1.0格式)'}`);
      
      // Load rules to backend after parsing
      setTimeout(() => {
        if (v2Format) {
          // v2.0: Load auto_watch rules
          const v2Data = parsed as DashboardDataV2;
          if (v2Data.auto_watch && v2Data.auto_watch.length > 0) {
            loadRulesV2ToBackend(v2Data.auto_watch);
          }
        } else {
          // v1.0: Load watch_prices rules
          const watchPrices = (parsed as DashboardDataV1).watch_prices || (parsed as DashboardDataV1).watch_prices_afternoon;
          if (watchPrices && Object.keys(watchPrices).length > 0) {
            loadRulesToBackend(watchPrices);
          }
        }
      }, 100);
    } catch (err) {
      setError(`JSON 解析失败: ${(err as Error).message}`);
      setDashboardData(null);
      showToast('error', '数据解析失败');
    }
  };

  const handleLoadSample = () => {
    setDashboardData(sampleData);
    setRawInput(JSON.stringify(sampleData, null, 2));
    setError(null);
    setPushStatus({});
    showToast('success', '已加载示例数据');
    // Load rules to backend
    setTimeout(() => {
      if (sampleData.watch_prices && Object.keys(sampleData.watch_prices).length > 0) {
        loadRulesToBackend();
      }
    }, 100);
  };

  const handleClearData = () => {
    setDashboardData(null);
    setRawInput('');
    setPushStatus({});
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PUSH_STATUS_KEY);
    showToast('success', '已清除数据');
  };

  const toggleActionComplete = (key: string, item?: { stock_code: string; stock_name: string; action: 'buy' | 'sell'; quantity: number }) => {
    const newCompleted = new Set(completedActions);
    if (newCompleted.has(key)) {
      newCompleted.delete(key);
      setExecutionLogs(prev => prev.filter(log => log.id !== key));
    } else {
      newCompleted.add(key);
      if (item) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const newLog: ExecutionLog = {
          id: key,
          stock_code: item.stock_code,
          stock_name: item.stock_name,
          action: item.action,
          quantity: item.quantity,
          executed_at: timeStr,
        };
        setExecutionLogs(prev => [...prev, newLog]);
      }
    }
    setCompletedActions(newCompleted);
  };

  const clearAllLogs = () => {
    setExecutionLogs([]);
    setCompletedActions(new Set());
  };

  const testPriceAlert = async (stockCode: string) => {
    const v1Data = dashboardData as DashboardDataV1;
    const watchPrices = v1Data?.watch_prices || v1Data?.watch_prices_afternoon;
    const watchItem = watchPrices?.[stockCode];
    if (!watchItem) return;
    
    setSendingAlert(prev => new Set(prev).add(stockCode));
    
    try {
      const response = await fetch('/api/v1/agent/test-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock_code: stockCode,
          stock_name: watchItem.name,
          operation: watchItem.operation || '关注',
          watch_price: watchItem.watch_price,
          note: watchItem.note,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail?.message || errorData?.detail || '推送失败');
      }

      const result = await response.json();
      if (result.success) {
        // Update push status
        setPushStatus(prev => ({
          ...prev,
          [stockCode]: {
            pushed: true,
            pushedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          }
        }));
        showToast('success', result.message);
      } else {
        showToast('error', result.message);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '推送异常';
      showToast('error', errorMsg);
    } finally {
      setSendingAlert(prev => {
        const next = new Set(prev);
        next.delete(stockCode);
        return next;
      });
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num == null) return '-';
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPnl = (pnl: number | undefined | null) => {
    if (pnl == null) return <span className="text-secondary-text">-</span>;
    const sign = pnl >= 0 ? '+' : '';
    const color = pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    return <span className={color}>{sign}{formatNumber(pnl)}</span>;
  };

  // Auto Monitor Toggle Handler
  const handleToggleAutoMonitor = async () => {
    if (!autoMonitorEnabled) {
      try {
        const res = await fetch('/api/v1/agent/monitor/enable', { method: 'POST' });
        if (res.ok) {
          setAutoMonitorEnabled(true);
          // Don't call loadMonitorStatus here to avoid unnecessary re-render
          showToast('success', '自动监盘已启用');
        } else {
          showToast('error', '启用监盘失败');
        }
      } catch (err) {
        showToast('error', '网络请求失败');
      }
    } else {
      try {
        const res = await fetch('/api/v1/agent/monitor/disable', { method: 'POST' });
        if (res.ok) {
          setAutoMonitorEnabled(false);
          // Don't call loadMonitorStatus here to avoid unnecessary re-render
          showToast('success', '自动监盘已关闭');
        } else {
          showToast('error', '关闭监盘失败');
        }
      } catch (err) {
        showToast('error', '网络请求失败');
      }
    }
  };

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">操作指令看板</h1>
          <button
            onClick={handleLoadSample}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FileJson className="h-4 w-4" />
            加载示例数据
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">粘贴 JSON 数据</h2>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="在此粘贴操作指令 JSON..."
            className="h-64 w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleParse}
              disabled={!rawInput.trim()}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              解析并渲染
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 pb-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl border px-5 py-4 shadow-lg backdrop-blur-sm',
              toastMessage.type === 'success'
                ? 'border-green-200 bg-green-50/95 text-green-800 dark:border-green-800 dark:bg-green-900/95 dark:text-green-200'
                : 'border-red-200 bg-red-50/95 text-red-800 dark:border-red-800 dark:bg-red-900/95 dark:text-red-200'
            )}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <p className="text-sm font-medium">{toastMessage.text}</p>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 rounded p-1 transition-colors hover:bg-black/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            操作指令看板 {isV2 && (dashboardData as DashboardDataV2).trade_date && `(${(dashboardData as DashboardDataV2).trade_date}执行)`}
          </h1>
          <p className="mt-1 text-sm text-secondary-text">
            {!isV2 && (dashboardData as DashboardDataV1).date}{!isV2 && (dashboardData as DashboardDataV1).time ? ` · ${(dashboardData as DashboardDataV1).time}` : ''}{dashboardData.generated_at ? ` · 生成于 ${dashboardData.generated_at}` : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClearData}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            清除数据
          </button>
          <button
            onClick={() => setDashboardData(null)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FileJson className="h-4 w-4" />
            重新加载
          </button>
        </div>
      </div>

      {/* Auto Monitor Status Banner */}
      <div className={cn(
        'rounded-xl border p-4 transition-colors',
        autoMonitorEnabled
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
          : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
      )}>
        <div className="flex items-start gap-3">
          <Bell className={cn(
            'mt-0.5 h-5 w-5 shrink-0',
            autoMonitorEnabled ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
          )} />
          <div className="flex-1">
            <h3 className={cn(
              'text-sm font-semibold',
              autoMonitorEnabled ? 'text-green-800 dark:text-green-300' : 'text-blue-800 dark:text-blue-300'
            )}>
              自动监盘状态
            </h3>
            <p className={cn(
              'mt-1 text-sm',
              autoMonitorEnabled ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'
            )}>
              {autoMonitorEnabled
                ? `监控已启用，每 5 分钟自动检查一次价格。已加载 ${monitorStatus?.rule_count || 0} 条预警规则，共检查 ${monitorStatus?.check_count || 0} 次，触发 ${monitorStatus?.trigger_count || 0} 次预警，成功推送 ${monitorStatus?.push_success_count || 0} 次。`
                : '点击"启用监盘"开启自动价格监控。达到预警价时将自动推送到飞书。'
              }
            </p>
            {monitorStatus?.last_check_time && (
              <p className="mt-1 text-xs text-secondary-text">
                上次检查: {new Date(monitorStatus.last_check_time).toLocaleString('zh-CN')}
              </p>
            )}
            <button
              onClick={handleToggleAutoMonitor}
              className={cn(
                'mt-3 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                autoMonitorEnabled
                  ? 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300'
              )}
            >
              {autoMonitorEnabled ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  关闭监盘
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  启用监盘
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Logic Flow Banner - v2.1 */}
      {isV2 && (dashboardData as DashboardDataV2).logic_flow && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                 执行逻辑流程 (v{(dashboardData as DashboardDataV2).logic_flow!.version})
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                {(dashboardData as DashboardDataV2).logic_flow!.description}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-700 dark:bg-slate-800">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">① 启动条件 (trigger)</p>
                  <p className="mt-1 text-xs text-secondary-text">{(dashboardData as DashboardDataV2).logic_flow!.trigger}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-white p-3 dark:border-orange-700 dark:bg-slate-800">
                  <p className="text-xs font-medium text-orange-600 dark:text-orange-400">② 否决条件 (reject_if)</p>
                  <p className="mt-1 text-xs text-secondary-text">{(dashboardData as DashboardDataV2).logic_flow!.reject_if}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-white p-3 dark:border-red-700 dark:bg-slate-800">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400"> 撤销条件 (cancel_if)</p>
                  <p className="mt-1 text-xs text-secondary-text">{(dashboardData as DashboardDataV2).logic_flow!.cancel_if}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardData.summary ? (
          <>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-secondary-text">总资产</p>
              <p className="mt-2 text-2xl font-bold text-foreground">¥{formatNumber(dashboardData.summary.total_assets)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-secondary-text">可用现金</p>
              <p className="mt-2 text-2xl font-bold text-foreground">¥{formatNumber(dashboardData.summary.cash)}</p>
              <p className="mt-1 text-xs text-secondary-text">占比 {dashboardData.summary.cash_ratio_pct}%</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-secondary-text">持仓市值</p>
              <p className="mt-2 text-2xl font-bold text-foreground">¥{formatNumber(!isV2 ? (dashboardData as DashboardDataV1).summary!.total_market_value : (dashboardData as DashboardDataV2).summary.stock_value)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-secondary-text">浮动盈亏</p>
              <p className="mt-2 text-2xl font-bold">{formatPnl(dashboardData.summary.unrealized_pnl)}</p>
            </div>
          </>
        ) : (
          <div className="col-span-full rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              午盘更新模式：仅持仓和预警信息，资产数据请查看完整看板。
            </p>
          </div>
        )}
      </div>

      {/* Market Context */}
      {isV2 ? (
        // v2.0 Market Indexes
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Target className="h-5 w-5 text-primary" />
            市场概况
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: 'shanghai', label: '上证指数', index: (dashboardData as DashboardDataV2).summary?.indexes?.shanghai },
              { key: 'chi_next50', label: '创业板50', index: (dashboardData as DashboardDataV2).summary?.indexes?.chi_next50 },
              { key: 'shanghai50', label: '上证50', index: (dashboardData as DashboardDataV2).summary?.indexes?.shanghai50 },
            ].filter(({ index }) => index).map(({ key, label, index }) => (
              <div key={key} className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="mt-2 text-xl font-bold text-foreground">{index!.close.toFixed(2)}</p>
                <p className={cn(
                  'mt-1 text-sm font-medium',
                  index!.change_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {index!.change_pct >= 0 ? '+' : ''}{index!.change_pct.toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-secondary-text">{index!.trend}</p>
              </div>
            ))}
          </div>
        </div>
      ) : dashboardData && (dashboardData as DashboardDataV1).summary?.market_context ? (
        // v1.0 Market Context (legacy)
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Target className="h-5 w-5 text-primary" />
            市场概况
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries((dashboardData as DashboardDataV1).summary!.market_context).filter(([, index]) => index).map(([key, index]) => {
              if (!index) return null;
              return (
            <div key={key} className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">
                {key === 'shanghai_composite' && '上证指数'}
                {key === 'shenzhen_component' && '深证成指'}
                {key === 'chi_next_50' && '创业板50'}
                {key === 'shanghai_50' && '上证50'}
                {!['shanghai_composite', 'shenzhen_component', 'chi_next_50', 'shanghai_50'].includes(key) && key}
              </p>
              <p className="mt-2 text-xl font-bold text-foreground">{index.close.toFixed(2)}</p>
              <p className={cn(
                'mt-1 text-sm font-medium',
                index.change_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                {index.change_pct >= 0 ? '+' : ''}{index.change_pct.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-secondary-text">{index.note}</p>
            </div>
          );
            })}
          </div>
        </div>
      ) : null}

      {/* Orders - v2.0 Unified Orders */}
      {isV2 && (dashboardData as DashboardDataV2).orders && (dashboardData as DashboardDataV2).orders.length > 0 && (
        <div className={cn(
          'rounded-xl border p-6 shadow-sm',
          'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
        )}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-orange-800 dark:text-orange-300">
            <AlertCircle className="h-5 w-5" />
            交易指令 ({(dashboardData as DashboardDataV2).orders.length})
          </h2>
          <div className="space-y-3">
            {(dashboardData as DashboardDataV2).orders
              .sort((a, b) => a.priority - b.priority) // Sort by priority
              .map((order) => {
              const actionKey = `order_${order.id}`;
              const isCompleted = completedActions.has(actionKey);
              const isBuy = order.direction === 'buy';
              
              // Trigger type mapping
              const triggerLabel = {
                'price_above': `价格突破 ¥${order.trigger.value}`,
                'price_below': `价格跌破 ¥${order.trigger.value}`,
                'volume_above_and_price_above': `放量突破 ¥${order.trigger.value}`,
              }[order.trigger.type] || order.trigger.type;
              
              // Validity label
              const validityLabel = order.validity === 'today' ? '今日有效' : '长期有效';
              
              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-lg border bg-white p-4 transition-all dark:bg-slate-800',
                    isCompleted ? 'border-green-300 opacity-60 dark:border-green-700' : 'border-orange-200 dark:border-orange-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                          P{order.priority}
                        </span>
                        <h3 className="font-semibold text-foreground">
                          {order.stock_name} ({order.stock_code})
                        </h3>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                          isBuy 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        )}>
                          {isBuy ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {isBuy ? '买入' : '卖出'} {order.quantity}股 @ ¥{order.price}
                        </span>
                        <span className="text-xs text-secondary-text">{validityLabel}</span>
                      </div>
                      <p className="mt-2 text-sm text-secondary-text">
                        <span className="font-medium">触发条件:</span> {triggerLabel}
                      </p>
                      <p className="mt-2 text-sm text-foreground">{order.reason}</p>
                    </div>
                    <button
                      onClick={() => toggleActionComplete(actionKey, { 
                        stock_code: order.stock_code, 
                        stock_name: order.stock_name, 
                        action: order.direction, 
                        quantity: order.quantity 
                      })}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                        isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 hover:border-green-500 dark:border-gray-600'
                      )}
                    >
                      {isCompleted && <CheckCircle2 className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Must Do Actions - v1.0 Legacy */}
      {!isV2 && (dashboardData as DashboardDataV1).must_do && (dashboardData as DashboardDataV1).must_do.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-sm dark:border-orange-800 dark:bg-orange-900/20">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-orange-800 dark:text-orange-300">
            <AlertCircle className="h-5 w-5" />
            必须执行 ({(dashboardData as DashboardDataV1).must_do.length})
          </h2>
          <div className="space-y-3">
            {(dashboardData as DashboardDataV1).must_do.map((item: MustDoItem, idx: number) => {
              const actionKey = `must_${idx}`;
              const isCompleted = completedActions.has(actionKey);
              return (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border bg-white p-4 transition-all dark:bg-slate-800',
                    isCompleted ? 'border-green-300 opacity-60 dark:border-green-700' : 'border-orange-200 dark:border-orange-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                          P{item.priority}
                        </span>
                        <h3 className="font-semibold text-foreground">
                          {item.stock_name} ({item.stock_code})
                        </h3>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                          item.action === 'buy' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        )}>
                          {item.action === 'buy' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {item.action === 'buy' ? '买入' : '卖出'} {item.quantity}股
                        </span>
                      </div>
                      {item.price_range && (
                        <p className="mt-2 text-sm text-secondary-text">
                          价格区间: ¥{item.price_range.min} ~ ¥{item.price_range.max}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-foreground">{item.reason}</p>
                      <p className="mt-1 text-xs text-secondary-text">{item.note}</p>
                    </div>
                    <button
                      onClick={() => toggleActionComplete(actionKey, { stock_code: item.stock_code, stock_name: item.stock_name, action: item.action, quantity: item.quantity })}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                        isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 hover:border-green-500 dark:border-gray-600'
                      )}
                    >
                      {isCompleted && <CheckCircle2 className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conditional Actions - v1.0 Legacy */}
      {!isV2 && (dashboardData as DashboardDataV1).conditional && (dashboardData as DashboardDataV1).conditional.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-800 dark:text-blue-300">
            <Clock className="h-5 w-5" />
            条件单 ({(dashboardData as DashboardDataV1).conditional.length})
          </h2>
          <div className="space-y-3">
            {(dashboardData as DashboardDataV1).conditional.map((item: ConditionalItem, idx: number) => {
              const actionKey = `cond_${idx}`;
              const isCompleted = completedActions.has(actionKey);
              return (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border bg-white p-4 transition-all dark:bg-slate-800',
                    isCompleted ? 'border-green-300 opacity-60 dark:border-green-700' : 'border-blue-200 dark:border-blue-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          P{item.priority}
                        </span>
                        <h3 className="font-semibold text-foreground">
                          {item.stock_name} ({item.stock_code})
                        </h3>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                          item.action === 'buy' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        )}>
                          {item.action === 'buy' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {item.action === 'buy' ? '买入' : '卖出'} {item.quantity}股
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-secondary-text">
                        <span className="font-medium">触发条件:</span> {item.trigger}
                      </p>
                      <p className="mt-1 text-sm text-foreground">{item.reason}</p>
                      {item.stop_loss && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">止损: ¥{item.stop_loss}</p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleActionComplete(actionKey, { stock_code: item.stock_code, stock_name: item.stock_name, action: item.action, quantity: item.quantity })}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                        isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 hover:border-green-500 dark:border-gray-600'
                      )}
                    >
                      {isCompleted && <CheckCircle2 className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Positions - v2.0 Holdings with Action */}
      {isV2 && (dashboardData as DashboardDataV2).positions && (dashboardData as DashboardDataV2).positions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Eye className="h-5 w-5 text-primary" />
            持仓管理 ({(dashboardData as DashboardDataV2).positions.length})
          </h2>
          <div className="space-y-3">
            {(dashboardData as DashboardDataV2).positions.map((pos) => {
              const actionColor = {
                'hold': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                'add': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                'reduce': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
                'sell': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
              }[pos.action];
              
              const actionLabel = {
                'hold': '持有',
                'add': '加仓',
                'reduce': '减仓',
                'sell': '清仓',
              }[pos.action];
              
              return (
                <div key={pos.stock_code} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">
                          {pos.stock_name} ({pos.stock_code})
                        </h3>
                        <span className={cn(
                          'text-xs font-medium',
                          pos.day_change_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        )}>
                          {pos.day_change_pct >= 0 ? '+' : ''}{pos.day_change_pct.toFixed(2)}%
                        </span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                          actionColor
                        )}>
                          {actionLabel}
                        </span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                          pos.score >= 70 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : pos.score >= 50
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        )}>
                          评分 {pos.score}分
                        </span>
                        <span className="text-xs text-secondary-text">{pos.ma_status}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                        <div>
                          <p className="text-xs text-secondary-text">持仓</p>
                          <p className="font-medium text-foreground">{pos.shares}股</p>
                        </div>
                        <div>
                          <p className="text-xs text-secondary-text">成本</p>
                          <p className="font-medium text-foreground">¥{pos.avg_cost}</p>
                        </div>
                        <div>
                          <p className="text-xs text-secondary-text">现价</p>
                          <p className="font-medium text-foreground">¥{pos.last_price}</p>
                        </div>
                        <div>
                          <p className="text-xs text-secondary-text">盈亏</p>
                          <p className="font-medium">{formatPnl(pos.unrealized_pnl)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-secondary-text">仓位</p>
                          <p className="font-medium text-foreground">{pos.weight_pct != null ? pos.weight_pct.toFixed(1) : '-'}%</p>
                        </div>
                      </div>
                      {pos.stop_loss != null && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-secondary-text">
                          <span className="text-red-600 dark:text-red-400">止损 ¥{pos.stop_loss}</span>
                        </div>
                      )}
                      <p className="mt-2 text-sm text-foreground">{pos.note}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Holdings - v1.0 Legacy */}
      {!isV2 && (dashboardData as DashboardDataV1).hold && (dashboardData as DashboardDataV1).hold.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Eye className="h-5 w-5 text-primary" />
            持仓观察 ({(dashboardData as DashboardDataV1).hold.length})
          </h2>
          <div className="space-y-3">
            {(dashboardData as DashboardDataV1).hold.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {item.stock_name} ({item.stock_code})
                    </h3>
                    {typeof item.change_pct === 'number' && (
                      <span className={cn(
                        'text-xs font-medium',
                        item.change_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                      </span>
                    )}
                    <span className={cn(
                      'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                      item.trend_score >= 70 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : item.trend_score >= 50
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    )}>
                      趋势 {item.trend_score}分
                    </span>
                    <span className="text-xs text-secondary-text">{item.trend_status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-secondary-text">持仓</p>
                      <p className="font-medium text-foreground">{item.shares}股</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-text">成本</p>
                      <p className="font-medium text-foreground">¥{item.avg_cost}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-text">现价</p>
                      <p className="font-medium text-foreground">¥{item.current_price}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-text">盈亏</p>
                      <p className="font-medium">{formatPnl(item.unrealized_pnl)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-secondary-text">
                    <span>仓位 {item.weight_pct}%</span>
                    {item.stop_loss && <span className="text-red-600 dark:text-red-400">止损 ¥{item.stop_loss}</span>}
                  </div>
                  <p className="mt-2 text-sm text-foreground">{item.note}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Auto Watch - v2.0 New Feature */}
      {isV2 && (dashboardData as DashboardDataV2).auto_watch && (dashboardData as DashboardDataV2).auto_watch!.length > 0 && (
        <div className={cn(
          'rounded-xl border p-6 shadow-sm',
          'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20'
        )}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-purple-800 dark:text-purple-300">
              <Bell className="h-5 w-5" />
              自动盯盘 ({(dashboardData as DashboardDataV2).auto_watch!.length})
            </h2>
            {(dashboardData as DashboardDataV2).watch_rules && (
              <span className="text-xs text-purple-600 dark:text-purple-400">
                扫描间隔: {(dashboardData as DashboardDataV2).watch_rules!.scan_interval_seconds}秒
              </span>
            )}
          </div>
          <div className="space-y-3">
            {(dashboardData as DashboardDataV2).auto_watch!
              .sort((a, b) => a.priority - b.priority)
              .map((watch) => {
              const isNotifyOnly = watch.execution.mode === 'notify_only';
              const isAutoLimit = watch.execution.mode === 'auto_limit';
              
              // Trigger type mapping
              const triggerLabel = {
                'price_drop_to': `价格跌至 ¥${watch.trigger.target}`,
                'price_rise_to': `价格上涨至 ¥${watch.trigger.target}`,
                'volume_surge_and_price_break': `放量突破 ¥${watch.trigger.price_above}`,
                'price_alert': `价格提醒 ¥${watch.trigger.target}`,
              }[watch.trigger.type] || watch.trigger.type;
              
              // Execution mode label
              const modeLabel = {
                'auto_limit': '自动限价',
                'auto_market': '自动市价',
                'notify_only': '仅通知',
              }[watch.execution.mode];
              
              // Direction label
              const directionLabel = {
                'buy': '买入',
                'sell': '卖出',
                'none': '仅监控',
              }[watch.direction];
              
              return (
                <div
                  key={watch.id}
                  className={cn(
                    'rounded-lg border bg-white p-4 transition-all dark:bg-slate-800',
                    isNotifyOnly ? 'border-blue-200 dark:border-blue-700' : 'border-purple-200 dark:border-purple-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          P{watch.priority}
                        </span>
                        <h3 className="font-semibold text-foreground">
                          {watch.stock_name} ({watch.stock_code})
                        </h3>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                          watch.direction === 'buy' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : watch.direction === 'sell'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        )}>
                          {directionLabel}
                          {watch.quantity > 0 && ` ${watch.quantity}股`}
                        </span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                          isNotifyOnly
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : isAutoLimit
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        )}>
                          {modeLabel}
                        </span>
                        <span className="text-xs text-secondary-text">
                          {watch.execution.validity === 'today' ? '今日有效' : '长期有效'}
                        </span>
                      </div>
                      
                      {/* Trigger */}
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-secondary-text">
                          <span className="font-medium text-blue-600 dark:text-blue-400">① 启动条件:</span> {triggerLabel}
                        </p>
                        {watch.trigger.logic_note && (
                          <p className="text-xs text-blue-500 dark:text-blue-400 ml-2">💡 {watch.trigger.logic_note}</p>
                        )}
                      </div>
                      
                      {/* Reject If (v2.1: flat or v2.0: nested) */}
                      {(watch.reject_if || (watch.condition?.reject_if && Object.keys(watch.condition.reject_if).some(k => k !== 'logic_note'))) && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-secondary-text">
                            <span className="font-medium text-orange-600 dark:text-orange-400">② 否决条件:</span>{' '}
                            {(() => {
                              const rejectData = watch.reject_if || watch.condition?.reject_if;
                              if (!rejectData) return null;
                              return Object.entries(rejectData)
                                .filter(([key]) => key !== 'logic_note')
                                .map(([key, value]) => (
                                  <span key={key} className="mr-2">
                                    {key === 'volume_ratio_below' && `量比低于 ${value}`}
                                    {key === 'market_depth_sell_wall_gte' && `卖盘挂单 >= ${value}`}
                                    {key === 'price_drop_to' && `价格跌破 ${value}`}
                                  </span>
                                ));
                            })()}
                          </p>
                          {(() => {
                            const rejectData = watch.reject_if || watch.condition?.reject_if;
                            return rejectData?.logic_note ? (
                              <p className="text-xs text-orange-500 dark:text-orange-400 ml-2">💡 {rejectData.logic_note}</p>
                            ) : null;
                          })()}
                        </div>
                      )}
                      
                      {/* Cancel If (v2.1: flat or v2.0: nested) */}
                      {(watch.cancel_if || (watch.condition?.cancel_if && Object.keys(watch.condition.cancel_if).some(k => k !== 'logic_note'))) && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-secondary-text">
                            <span className="font-medium text-red-600 dark:text-red-400"> 撤销条件:</span>{' '}
                            {(() => {
                              const cancelData = watch.cancel_if || watch.condition?.cancel_if;
                              if (!cancelData) return null;
                              return Object.entries(cancelData)
                                .filter(([key]) => key !== 'logic_note')
                                .map(([key, value]) => (
                                  <span key={key} className="mr-2">
                                    {key === 'price_gap_open_above' && `跳空高开超过 ${value}`}
                                    {key === 'time_passed' && `时间超过 ${value}`}
                                  </span>
                                ));
                            })()}
                          </p>
                          {(() => {
                            const cancelData = watch.cancel_if || watch.condition?.cancel_if;
                            return cancelData?.logic_note ? (
                              <p className="text-xs text-red-500 dark:text-red-400 ml-2">💡 {cancelData.logic_note}</p>
                            ) : null;
                          })()}
                        </div>
                      )}
                      
                      {/* Execution details */}
                      {!isNotifyOnly && (
                        <div className="mt-2 text-xs text-secondary-text">
                          <span className="font-medium">执行细节:</span>{' '}
                          {isAutoLimit && watch.execution.limit_price_offset && (
                            <span>限价偏移 {watch.execution.limit_price_offset > 0 ? '+' : ''}{watch.execution.limit_price_offset}</span>
                          )}
                          {watch.execution.retry_on_fail && (
                            <span className="ml-2">失败重试 (最多{watch.execution.max_retries}次)</span>
                          )}
                        </div>
                      )}
                      
                      {/* Reason */}
                      <p className="mt-2 text-sm text-foreground">{watch.reason}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Watch Rules Summary */}
          {(dashboardData as DashboardDataV2).watch_rules && (
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-100 p-3 dark:border-purple-700 dark:bg-purple-900/30">
              <p className="text-xs font-medium text-purple-800 dark:text-purple-300">全局监控规则：</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-purple-700 dark:text-purple-400 sm:grid-cols-4">
                <div>
                  <span className="font-medium">执行通知：</span>
                  {(dashboardData as DashboardDataV2).watch_rules!.notify_on_execute ? '✅ 开启' : '❌ 关闭'}
                </div>
                <div>
                  <span className="font-medium">拒绝通知：</span>
                  {(dashboardData as DashboardDataV2).watch_rules!.notify_on_reject ? '✅ 开启' : '❌ 关闭'}
                </div>
                <div>
                  <span className="font-medium">撤销通知：</span>
                  {(dashboardData as DashboardDataV2).watch_rules!.notify_on_cancel ? '✅ 开启' : '❌ 关闭'}
                </div>
                <div>
                  <span className="font-medium">最大并发：</span>
                  {(dashboardData as DashboardDataV2).watch_rules!.fail_safe?.max_concurrent_watches || 10}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Watch Prices - v1.0 Legacy */}
      {!isV2 && ((dashboardData as DashboardDataV1).watch_prices || (dashboardData as DashboardDataV1).watch_prices_afternoon) && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Target className="h-5 w-5 text-primary" />
            价格预警
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">股票代码</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">名称</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">操作</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">预警价</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">说明</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">推送状态</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary-text">操作</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries((dashboardData as DashboardDataV1).watch_prices || (dashboardData as DashboardDataV1).watch_prices_afternoon || {}).map(([code, item]) => {
                const status = pushStatus[code];
                return (
                  <tr key={code} className="border-b border-border/50 hover:bg-hover/50">
                    <td className="px-4 py-3 font-mono text-foreground">{code}</td>
                    <td className="px-4 py-3 text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-secondary-text">{item.operation || '-'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">¥{item.watch_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-secondary-text">{item.note}</td>
                    <td className="px-4 py-3">
                      {status?.pushed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          已推送 {status.pushedAt}
                        </span>
                      ) : (
                        <span className="text-xs text-secondary-text">未推送</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => testPriceAlert(code)}
                        disabled={sendingAlert.has(code)}
                        className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {sendingAlert.has(code) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Bell className="h-3 w-3" />
                        )}
                        {sendingAlert.has(code) ? '推送中...' : status?.pushed ? '再次推送' : '测试推送'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Execution Log Panel */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-800 dark:bg-green-900/20">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5" />
            今日执行记录 ({executionLogs.length})
          </h2>
          {executionLogs.length > 0 && (
            <button
              onClick={clearAllLogs}
              className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
              清空记录
            </button>
          )}
        </div>
        
        {executionLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-green-300 bg-white p-8 text-center dark:border-green-700 dark:bg-slate-800">
            <Clock className="mx-auto mb-2 h-8 w-8 text-green-400" />
            <p className="text-sm text-secondary-text">🕐 今日暂无执行记录</p>
            <p className="mt-1 text-xs text-secondary-text">{isV2 ? '执行日志已从 JSON 加载' : '勾选上面的操作后，执行记录将在此显示'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {executionLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-green-200 bg-white p-4 dark:border-green-700 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{log.stock_name}</span>
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium" style={{
                      backgroundColor: log.action === 'sell' ? '#fee2e2' : '#dcfce7',
                      color: log.action === 'sell' ? '#dc2626' : '#16a34a'
                    }}>
                      {log.action === 'sell' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                      {log.action === 'sell' ? '卖出' : '买入'}
                    </span>
                    {typeof log.quantity === 'number' && log.quantity > 0 && (
                      <span className="text-sm text-foreground">{log.quantity}股</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-secondary-text">
                      ⏱ 执行时间: <strong className="text-foreground">{log.executed_at}</strong>
                    </p>
                    {log.executed_price && (
                      <p className="text-xs text-secondary-text">💰 执行价格: ¥{log.executed_price}</p>
                    )}
                    {log.note && (
                      <p className="text-xs text-secondary-text mt-1">📝 {log.note}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>✅ 已同步至持仓</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution Notes - v1.0 Legacy */}
      {!isV2 && (dashboardData as DashboardDataV1).execution_notes && (dashboardData as DashboardDataV1).execution_notes!.length > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-6 shadow-sm dark:border-purple-800 dark:bg-purple-900/20">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-purple-800 dark:text-purple-300">
            <FileJson className="h-5 w-5" />
            执行说明
          </h2>
          <ul className="space-y-2">
            {(dashboardData as DashboardDataV1).execution_notes!.map((note: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-300">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500"></span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OperationDashboardPage;