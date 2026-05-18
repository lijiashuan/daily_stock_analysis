import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Bell, CheckCircle2, Clock, Eye, FileJson, RefreshCw, Target, Trash2, Loader2, X } from 'lucide-react';
import { cn } from '../utils/cn';

// Types
interface MarketContext {
  shanghai_composite: { close: number; change_pct: number; note: string };
  shenzhen_component: { close: number; change_pct: number; note: string };
  chi_next_50: { close: number; change_pct: number; note: string };
  shanghai_50: { close: number; change_pct: number; note: string };
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

interface DashboardData {
  dashboard_version: string;
  generated_at: string;
  date: string;
  summary: {
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
  watch_prices: Record<string, WatchPriceItem>;
  execution_notes: string[];
}

interface ExecutionLog {
  id: string;
  stock_code: string;
  stock_name: string;
  action: 'buy' | 'sell';
  quantity: number;
  executed_price?: number;
  executed_at: string;
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

  // Load rules to backend when dashboard data changes
  useEffect(() => {
    if (dashboardData?.watch_prices && Object.keys(dashboardData.watch_prices).length > 0) {
      loadRulesToBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData?.watch_prices]);

  const loadRulesToBackend = async () => {
    if (!dashboardData?.watch_prices) return;
    try {
      await fetch('/api/v1/agent/monitor/load-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watch_prices: dashboardData.watch_prices }),
      });
      loadMonitorStatus();
    } catch (err) {
      console.error('Failed to load rules:', err);
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
      setPushStatus({});
      showToast('success', '数据解析成功！');
      // Load rules to backend after parsing
      setTimeout(() => {
        if (parsed.watch_prices && Object.keys(parsed.watch_prices).length > 0) {
          loadRulesToBackend();
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
    const watchItem = dashboardData?.watch_prices[stockCode];
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

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPnl = (pnl: number) => {
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
          loadMonitorStatus();
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
          loadMonitorStatus();
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
          <h1 className="text-2xl font-bold text-foreground">操作指令看板</h1>
          <p className="mt-1 text-sm text-secondary-text">
            {dashboardData.date} · 生成于 {dashboardData.generated_at}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-2 text-2xl font-bold text-foreground">¥{formatNumber(dashboardData.summary.total_market_value)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-secondary-text">浮动盈亏</p>
          <p className="mt-2 text-2xl font-bold">{formatPnl(dashboardData.summary.unrealized_pnl)}</p>
        </div>
      </div>

      {/* Market Context */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Target className="h-5 w-5 text-primary" />
          市场概况
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(dashboardData.summary.market_context).map(([key, index]) => (
            <div key={key} className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">
                {key === 'shanghai_composite' && '上证指数'}
                {key === 'shenzhen_component' && '深证成指'}
                {key === 'chi_next_50' && '创业板50'}
                {key === 'shanghai_50' && '上证50'}
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
          ))}
        </div>
      </div>

      {/* Must Do Actions */}
      {dashboardData.must_do.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-sm dark:border-orange-800 dark:bg-orange-900/20">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-orange-800 dark:text-orange-300">
            <AlertCircle className="h-5 w-5" />
            必须执行 ({dashboardData.must_do.length})
          </h2>
          <div className="space-y-3">
            {dashboardData.must_do.map((item, idx) => {
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

      {/* Conditional Actions */}
      {dashboardData.conditional.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-800 dark:text-blue-300">
            <Clock className="h-5 w-5" />
            条件单 ({dashboardData.conditional.length})
          </h2>
          <div className="space-y-3">
            {dashboardData.conditional.map((item, idx) => {
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

      {/* Holdings */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Eye className="h-5 w-5 text-primary" />
          持仓观察 ({dashboardData.hold.length})
        </h2>
        <div className="space-y-3">
          {dashboardData.hold.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {item.stock_name} ({item.stock_code})
                    </h3>
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

      {/* Watch Prices */}
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
              {Object.entries(dashboardData.watch_prices).map(([code, item]) => {
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
            <p className="mt-1 text-xs text-secondary-text">勾选上面的操作后，执行记录将在此显示</p>
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
                    <span className="text-sm text-foreground">{log.quantity}股</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-secondary-text">
                      ⏱ 执行时间: <strong className="text-foreground">{log.executed_at}</strong>
                    </p>
                    {log.executed_price && (
                      <p className="text-xs text-secondary-text">💰 执行价格: ¥{log.executed_price}</p>
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

      {/* Execution Notes */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6 shadow-sm dark:border-purple-800 dark:bg-purple-900/20">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-purple-800 dark:text-purple-300">
          <FileJson className="h-5 w-5" />
          执行说明
        </h2>
        <ul className="space-y-2">
          {dashboardData.execution_notes.map((note, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-300">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500"></span>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default OperationDashboardPage;
