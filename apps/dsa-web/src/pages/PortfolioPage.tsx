import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';
import { portfolioApi } from '../api/portfolio';
import type { ParsedApiError } from '../api/error';
import { getParsedApiError } from '../api/error';
import { ApiErrorAlert, Card, Badge, ConfirmDialog, EmptyState, InlineAlert } from '../components/common';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { formatUiText } from '../i18n/uiText';
import { PORTFOLIO_TEXT } from '../locales/featureText';
import type { FxRefreshFeedback } from '../utils/portfolioFormat';
import {
  buildFxRefreshFeedback,
  formatBrokerLabel,
  formatCashDirectionLabel,
  formatCorporateActionLabel,
  formatMoney,
  formatPct,
  formatPositionMoney,
  formatPositionPrice,
  formatSideLabel,
  formatSignedPct,
  getCsvCommitVariant,
  getCsvParseVariant,
  getFxRefreshFeedbackVariant,
  getPositionPriceLabel,
  getNowIsoDatetime,
  hasPositionPrice,
} from '../utils/portfolioFormat';
import type {
  PortfolioAccountItem,
  PortfolioCashDirection,
  PortfolioCashLedgerListItem,
  PortfolioCorporateActionListItem,
  PortfolioCorporateActionType,
  PortfolioCostMethod,
  PortfolioImportBrokerItem,
  PortfolioImportCommitResponse,
  PortfolioImportParseResponse,
  PortfolioPositionItem,
  PortfolioRiskResponse,
  PortfolioSide,
  PortfolioSnapshotResponse,
  PortfolioTradeListItem,
  TradeMatchItem,
  TradeMatchResponse,
  UnmatchedLotItem,
  UnmatchedSellLotItem,
} from '../types/portfolio';

const PIE_COLORS = ['#00d4ff', '#00ff88', '#ffaa00', '#ff7a45', '#7f8cff', '#ff4466'];
const DEFAULT_PAGE_SIZE = 20;
const FALLBACK_BROKERS: PortfolioImportBrokerItem[] = [
  { broker: 'huatai', aliases: [], displayName: '华泰' },
  { broker: 'citic', aliases: ['zhongxin'], displayName: '中信' },
  { broker: 'cmb', aliases: ['cmbchina', 'zhaoshang'], displayName: '招商' },
];

type AccountOption = 'all' | number;
type EventType = 'trade' | 'cash' | 'corporate';

type FlatPosition = PortfolioPositionItem & {
  accountId: number;
  accountName: string;
};

type PendingDelete =
  | { eventType: 'trade'; id: number; message: string }
  | { eventType: 'cash'; id: number; message: string }
  | { eventType: 'corporate'; id: number; message: string }
  | { eventType: 'account'; id: number; name: string; message: string };

type PendingAccountDelete = {
  accountId: number;
  accountName: string;
};

type FxRefreshContext = {
  viewKey: string;
  requestId: number;
};

const PORTFOLIO_INPUT_CLASS =
  'input-surface input-focus-glow h-11 w-full rounded-xl border bg-transparent px-4 text-sm transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
const PORTFOLIO_SELECT_CLASS = `${PORTFOLIO_INPUT_CLASS} appearance-none pr-10`;
const PORTFOLIO_FILE_PICKER_CLASS =
  'input-surface input-focus-glow flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border bg-transparent px-4 text-sm transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const PortfolioPage: React.FC = () => {
  const { language } = useUiLanguage();
  const text = PORTFOLIO_TEXT[language];

  // Set page title
  useEffect(() => {
    document.title = text.documentTitle;
  }, [text.documentTitle]);

  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountOption>('all');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountCreating, setAccountCreating] = useState(false);
  const [accountCreateError, setAccountCreateError] = useState<string | null>(null);
  const [accountCreateSuccess, setAccountCreateSuccess] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    broker: 'Demo',
    market: 'cn' as 'cn' | 'hk' | 'us',
    baseCurrency: 'CNY',
    accountType: 'real' as 'real' | 'simulation',
  });
  const [costMethod, setCostMethod] = useState<PortfolioCostMethod>('fifo');
  const [snapshot, setSnapshot] = useState<PortfolioSnapshotResponse | null>(null);
  const [risk, setRisk] = useState<PortfolioRiskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fxRefreshing, setFxRefreshing] = useState(false);
  const [fxRefreshFeedback, setFxRefreshFeedback] = useState<FxRefreshFeedback | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [riskWarning, setRiskWarning] = useState<string | null>(null);
  const [writeWarning, setWriteWarning] = useState<string | null>(null);
  const [expandedMatchSymbol, setExpandedMatchSymbol] = useState<string | null>(null);
  const [stockNoteSaving, setStockNoteSaving] = useState<Record<string, boolean>>({});
  const [stockNoteSaved, setStockNoteSaved] = useState<Record<string, boolean>>({});
  const [stockNoteLoaded, setStockNoteLoaded] = useState<Record<string, boolean | undefined>>({});
  const [stockNoteLastSaved, setStockNoteLastSaved] = useState<Record<string, string>>({});
  const [stockNotes, setStockNotes] = useState<Record<string, string>>({});
  const [stockNoteEditing, setStockNoteEditing] = useState<Record<string, boolean>>({});
  const [matchData, setMatchData] = useState<TradeMatchResponse | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [positionAnalysisLoadingKey, setPositionAnalysisLoadingKey] = useState<string | null>(null);
  const [positionAnalysisMessage, setPositionAnalysisMessage] = useState<string | null>(null);

  const [brokers, setBrokers] = useState<PortfolioImportBrokerItem[]>([]);
  const [selectedBroker, setSelectedBroker] = useState('huatai');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDryRun, setCsvDryRun] = useState(true);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvCommitting, setCsvCommitting] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<PortfolioImportParseResponse | null>(null);
  const [csvCommitResult, setCsvCommitResult] = useState<PortfolioImportCommitResponse | null>(null);
  const [brokerLoadWarning, setBrokerLoadWarning] = useState<string | null>(null);
  const [importEventType, setImportEventType] = useState<'trade' | 'cash' | 'corporate'>('trade');

  const [backupStatus, setBackupStatus] = useState<Record<string, unknown> | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupMessageTone, setBackupMessageTone] = useState<'success' | 'warning' | 'danger'>('success');

  // 自动监盘配置
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorInterval, setMonitorInterval] = useState('5');
  const [monitorRules, setMonitorRules] = useState<Array<{
    id: string;
    stockCode: string;
    alertType: 'price_cross' | 'price_change_percent' | 'volume_spike';
    direction?: 'above' | 'below' | 'up' | 'down';
    price?: string;
    changePct?: string;
    multiplier?: string;
    description: string;
  }>>([]);
  const [newRule, setNewRule] = useState<{
    stockCode: string;
    alertType: 'price_cross' | 'price_change_percent' | 'volume_spike';
    direction: 'above' | 'below' | 'up' | 'down';
    price: string;
    changePct: string;
    multiplier: string;
    description: string;
  }>({
    stockCode: '',
    alertType: 'price_cross',
    direction: 'above',
    price: '',
    changePct: '3',
    multiplier: '2',
    description: '',
  });

  // 自动监盘 - 添加规则
  const handleAddMonitorRule = useCallback(() => {
    if (!newRule.stockCode.trim()) {
      return;
    }
    const id = Date.now().toString();
    const rule = {
      id,
      stockCode: newRule.stockCode.trim(),
      alertType: newRule.alertType,
      direction: newRule.direction,
      price: newRule.alertType === 'price_cross' ? newRule.price : undefined,
      changePct: newRule.alertType === 'price_change_percent' ? newRule.changePct : undefined,
      multiplier: newRule.alertType === 'volume_spike' ? newRule.multiplier : undefined,
      description: newRule.description.trim() || `${newRule.stockCode} ${newRule.alertType}`,
    };
    setMonitorRules((prev) => [...prev, rule]);
    setNewRule({
      stockCode: '',
      alertType: 'price_cross',
      direction: 'above',
      price: '',
      changePct: '3',
      multiplier: '2',
      description: '',
    });
  }, [newRule]);

  // 自动监盘 - 删除规则
  const handleRemoveMonitorRule = useCallback((id: string) => {
    setMonitorRules((prev) => prev.filter((rule) => rule.id !== id));
  }, []);


  const [eventType, setEventType] = useState<EventType>('trade');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');
  const [eventSymbol, setEventSymbol] = useState('');
  const [eventSide, setEventSide] = useState<'' | PortfolioSide>('');
  const [eventDirection, setEventDirection] = useState<'' | PortfolioCashDirection>('');
  const [eventActionType, setEventActionType] = useState<'' | PortfolioCorporateActionType>('');
  const [eventPage, setEventPage] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventLoading, setEventLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [tradeEvents, setTradeEvents] = useState<PortfolioTradeListItem[]>([]);
  const [cashEvents, setCashEvents] = useState<PortfolioCashLedgerListItem[]>([]);
  const [corporateEvents, setCorporateEvents] = useState<PortfolioCorporateActionListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pendingAccountDelete, setPendingAccountDelete] = useState<PendingAccountDelete | null>(null);
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);

  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    tradeDate: getNowIsoDatetime(),
    side: 'buy' as PortfolioSide,
    quantity: '',
    price: '',
    fee: '',
    tax: '',
    tradeUid: '',
    note: '',
  });
  const [feeAutoCalculated, setFeeAutoCalculated] = useState(false);

  // 手续费自动计算
  const calculateFee = useCallback((quantity: string, price: string, side: PortfolioSide): string => {
    const qty = parseFloat(quantity);
    const prc = parseFloat(price);
    if (isNaN(qty) || isNaN(prc) || qty <= 0 || prc <= 0) return '';
    
    const amount = qty * prc;
    let fee: number;
    
    if (side === 'buy') {
      // 买入：手续费 = 数量 * 成交价 / 100000 + 5
      fee = amount / 100000 + 5;
    } else {
      // 卖出：手续费 = 数量 * 成交价 / 100000 + 5 + 数量 * 成交价 * 5 / 10000
      fee = amount / 100000 + 5 + amount * 5 / 10000;
    }
    
    return fee.toFixed(2);
  }, []);
  const [cashForm, setCashForm] = useState({
    eventDate: getNowIsoDatetime(),
    direction: 'in' as PortfolioCashDirection,
    amount: '',
    currency: '',
    note: '',
  });
  const [corpForm, setCorpForm] = useState({
    symbol: '',
    effectiveDate: getNowIsoDatetime(),
    actionType: 'cash_dividend' as PortfolioCorporateActionType,
    cashDividendPerShare: '',
    splitRatio: '',
    note: '',
  });

  const queryAccountId = selectedAccount === 'all' ? undefined : selectedAccount;
  const refreshViewKey = `${selectedAccount === 'all' ? 'all' : `account:${selectedAccount}`}:cost:${costMethod}`;
  const refreshContextRef = useRef<FxRefreshContext>({ viewKey: refreshViewKey, requestId: 0 });
  const hasAccounts = accounts.length > 0;
  const writableAccount = selectedAccount === 'all' ? undefined : accounts.find((item) => item.id === selectedAccount);
  const writableAccountId = writableAccount?.id;
  const writeBlocked = !writableAccountId;
  const canDeleteSelectedAccount = Boolean(writableAccountId) && !isLoading && !fxRefreshing && !accountDeleteLoading;
  const totalEventPages = Math.max(1, Math.ceil(eventTotal / DEFAULT_PAGE_SIZE));
  const currentEventCount = eventType === 'trade'
    ? tradeEvents.length
    : eventType === 'cash'
      ? cashEvents.length
      : corporateEvents.length;

  const isActiveRefreshContext = (requestedViewKey: string, requestedRequestId: number) => {
    return (
      refreshContextRef.current.viewKey === requestedViewKey
      && refreshContextRef.current.requestId === requestedRequestId
    );
  };

  const loadAccounts = useCallback(async () => {
    try {
      const response = await portfolioApi.getAccounts(false);
      const items = response.accounts || [];
      setAccounts(items);
      setSelectedAccount((prev) => {
        if (items.length === 0) return 'all';
        if (prev !== 'all' && !items.some((item) => item.id === prev)) return items[0].id;
        return prev;
      });
      if (items.length === 0) setShowCreateAccount(true);
    } catch (err) {
      setError(getParsedApiError(err));
    }
  }, []);

  const loadBrokers = useCallback(async () => {
    try {
      const response = await portfolioApi.listImportBrokers();
      const brokerItems = response.brokers || [];
      if (brokerItems.length === 0) {
        setBrokers(FALLBACK_BROKERS);
        setBrokerLoadWarning('券商列表接口返回为空，已回退为内置券商列表（华泰/中信/招商）。');
        if (!FALLBACK_BROKERS.some((item) => item.broker === selectedBroker)) {
          setSelectedBroker(FALLBACK_BROKERS[0].broker);
        }
        return;
      }
      setBrokers(brokerItems);
      setBrokerLoadWarning(null);
      if (!brokerItems.some((item) => item.broker === selectedBroker)) {
        setSelectedBroker(brokerItems[0].broker);
      }
    } catch {
      setBrokers(FALLBACK_BROKERS);
      setBrokerLoadWarning('券商列表接口不可用，已回退为内置券商列表（华泰/中信/招商）。');
      if (!FALLBACK_BROKERS.some((item) => item.broker === selectedBroker)) {
        setSelectedBroker(FALLBACK_BROKERS[0].broker);
      }
    }
  }, [selectedBroker]);


  const loadSnapshotAndRisk = useCallback(async () => {
    setIsLoading(true);
    setRiskWarning(null);
    try {
      const snapshotData = await portfolioApi.getSnapshot({
        accountId: queryAccountId,
        costMethod,
      });
      setSnapshot(snapshotData);
      setError(null);

      try {
        const riskData = await portfolioApi.getRisk({
          accountId: queryAccountId,
          costMethod,
        });
        setRisk(riskData);
      } catch (riskErr) {
        setRisk(null);
        const parsed = getParsedApiError(riskErr);
        setRiskWarning(parsed.message || '风险数据获取失败，已降级为仅展示快照数据。');
      }
    } catch (err) {
      setSnapshot(null);
      setRisk(null);
      setError(getParsedApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [queryAccountId, costMethod]);

  const loadEventsPage = useCallback(async (page: number) => {
    setEventLoading(true);
    try {
      if (eventType === 'trade') {
        const response = await portfolioApi.listTrades({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          side: eventSide || undefined,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setTradeEvents(response.items || []);
        setEventTotal(response.total || 0);
      } else if (eventType === 'cash') {
        const response = await portfolioApi.listCashLedger({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          direction: eventDirection || undefined,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setCashEvents(response.items || []);
        setEventTotal(response.total || 0);
      } else {
        const response = await portfolioApi.listCorporateActions({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          actionType: eventActionType || undefined,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setCorporateEvents(response.items || []);
        setEventTotal(response.total || 0);
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setEventLoading(false);
    }
  }, [
    eventActionType,
    eventDateFrom,
    eventDateTo,
    eventDirection,
    eventSide,
    eventSymbol,
    eventType,
    queryAccountId,
  ]);

  const loadEvents = useCallback(async () => {
    await loadEventsPage(eventPage);
  }, [eventPage, loadEventsPage]);

  const refreshPortfolioData = useCallback(async (page = eventPage) => {
    await Promise.all([loadSnapshotAndRisk(), loadEventsPage(page)]);
  }, [eventPage, loadEventsPage, loadSnapshotAndRisk]);

  useEffect(() => {
    void loadAccounts();
    void loadBrokers();
  }, [loadAccounts, loadBrokers]);

  useEffect(() => {
    void loadSnapshotAndRisk();
  }, [loadSnapshotAndRisk]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    refreshContextRef.current = {
      viewKey: refreshViewKey,
      requestId: refreshContextRef.current.requestId + 1,
    };
    setFxRefreshing(false);
    setFxRefreshFeedback(null);
  }, [refreshViewKey]);

  useEffect(() => {
    setEventPage(1);
  }, [eventType, queryAccountId, eventDateFrom, eventDateTo, eventSymbol, eventSide, eventDirection, eventActionType]);

  useEffect(() => {
    if (!writeBlocked) {
      setWriteWarning(null);
    }
  }, [writeBlocked]);

  const positionRows: FlatPosition[] = useMemo(() => {
    if (!snapshot) return [];
    const rows: FlatPosition[] = [];
    
    // Always merge positions by symbol, regardless of account selection
    const mergedMap = new Map<string, FlatPosition>();
    const filteredAccounts = selectedAccount === 'all' 
      ? snapshot.accounts || []
      : snapshot.accounts?.filter(a => a.accountId === selectedAccount) || [];
    
    for (const account of filteredAccounts) {
      for (const position of account.positions || []) {
        const key = `${position.symbol}-${position.market}`;
        const existing = mergedMap.get(key);
        if (existing) {
          // Merge quantities and values
          const totalQty = existing.quantity + position.quantity;
          // Weighted average cost: (existing.avgCost * existing.quantity + position.avgCost * position.quantity) / totalQty
          const weightedCost = totalQty > 0 
            ? (existing.avgCost * existing.quantity + position.avgCost * position.quantity) / totalQty
            : existing.avgCost;
          const totalMv = (existing.marketValueBase || 0) + (position.marketValueBase || 0);
          const totalPnl = (existing.unrealizedPnlBase || 0) + (position.unrealizedPnlBase || 0);
          const totalRealizedPnl = ((existing as any).realizedPnlBase || 0) + ((position as any).realizedPnlBase || 0);
          const totalPnlPct = existing.totalCost > 0 && position.totalCost > 0
            ? (totalPnl / ((existing.totalCost || 0) + (position.totalCost || 0))) * 100
            : existing.unrealizedPnlPct;
          
          mergedMap.set(key, {
            ...position,
            accountId: existing.accountId, // Keep first account for reference
            accountName: selectedAccount === 'all' ? '汇总' : existing.accountName,
            quantity: totalQty,
            avgCost: weightedCost,
            marketValueBase: totalMv,
            unrealizedPnlBase: totalPnl,
            unrealizedPnlPct: totalPnlPct,
            realizedPnlBase: totalRealizedPnl,
            // Keep stock name if available, use the first non-empty one
            stockName: (existing as any).stockName || (position as any).stockName || undefined,
          });
        } else {
          mergedMap.set(key, {
            ...position,
            accountId: account.accountId,
            accountName: account.accountName,
          });
        }
      }
    }
    mergedMap.forEach((position) => rows.push(position));
    rows.sort((a, b) => Number(b.marketValueBase || 0) - Number(a.marketValueBase || 0));
    return rows;
  }, [snapshot, selectedAccount]);

  const handleAnalyzePosition = async (row: FlatPosition) => {
    const key = `${row.accountId}-${row.symbol}-${row.market}`;
    setPositionAnalysisLoadingKey(key);
    setPositionAnalysisMessage(null);
    setError(null);
    try {
      const task = await portfolioApi.analyzePosition(row.symbol, {
        accountId: row.accountId,
        analysisPhase: 'auto',
        force: false,
      });
      setPositionAnalysisMessage(`已提交 ${row.symbol} 分析任务：${task.taskId}`);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setPositionAnalysisLoadingKey(null);
    }
  };

  const sectorPieData = useMemo(() => {
    const sectors = risk?.sectorConcentration?.topSectors || [];
    return sectors
      .slice(0, 6)
      .map((item) => ({
        name: item.sector,
        value: Number(item.weightPct || 0),
      }))
      .filter((item) => item.value > 0);
  }, [risk]);

  const positionFallbackPieData = useMemo(() => {
    if (!risk?.concentration?.topPositions?.length) {
      return [];
    }
    return risk.concentration.topPositions
      .slice(0, 6)
      .map((item) => ({
        name: item.symbol,
        value: Number(item.weightPct || 0),
      }))
      .filter((item) => item.value > 0);
  }, [risk]);

  const concentrationPieData = sectorPieData.length > 0 ? sectorPieData : positionFallbackPieData;
  const concentrationMode = sectorPieData.length > 0 ? 'sector' : 'position';

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) {
      setWriteWarning('请先在右上角选择具体账户，再进行录入或导入提交。');
      return;
    }
    try {
      setWriteWarning(null);
      await portfolioApi.createTrade({
        accountId: writableAccountId,
        symbol: tradeForm.symbol,
        tradeDate: tradeForm.tradeDate,
        side: tradeForm.side,
        quantity: Number(tradeForm.quantity),
        price: Number(tradeForm.price),
        fee: Number(tradeForm.fee || 0),
        tax: Number(tradeForm.tax || 0),
        tradeUid: tradeForm.tradeUid || undefined,
        note: tradeForm.note || undefined,
      });
      await refreshPortfolioData();
      setTradeForm((prev) => ({ ...prev, symbol: '', tradeUid: '', note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) {
      setWriteWarning('请先在右上角选择具体账户，再进行录入或导入提交。');
      return;
    }
    try {
      setWriteWarning(null);
      await portfolioApi.createCashLedger({
        accountId: writableAccountId,
        eventDate: cashForm.eventDate,
        direction: cashForm.direction,
        amount: Number(cashForm.amount),
        currency: cashForm.currency || undefined,
        note: cashForm.note || undefined,
      });
      await refreshPortfolioData();
      setCashForm((prev) => ({ ...prev, note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleCorporateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) {
      setWriteWarning('请先在右上角选择具体账户，再进行录入或导入提交。');
      return;
    }
    try {
      setWriteWarning(null);
      await portfolioApi.createCorporateAction({
        accountId: writableAccountId,
        symbol: corpForm.symbol,
        effectiveDate: corpForm.effectiveDate,
        actionType: corpForm.actionType,
        cashDividendPerShare: corpForm.cashDividendPerShare ? Number(corpForm.cashDividendPerShare) : undefined,
        splitRatio: corpForm.splitRatio ? Number(corpForm.splitRatio) : undefined,
        note: corpForm.note || undefined,
      });
      await refreshPortfolioData();
      setCorpForm((prev) => ({ ...prev, symbol: '', note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleParseCsv = async () => {
    if (!csvFile) {
      setWriteWarning('请先选择 CSV 文件。');
      return;
    }
    try {
      setWriteWarning(null);
      setCsvParsing(true);
      const parsed = await portfolioApi.parseCsvImport(selectedBroker, csvFile, importEventType);
      setCsvParseResult(parsed);
      setCsvCommitResult(null);
    } catch (err) {
      const apiError = getParsedApiError(err);
      setWriteWarning(apiError.message || '解析文件失败，请稍后重试。');
      setError(apiError);
    } finally {
      setCsvParsing(false);
    }
  };

  const handleCommitCsv = async () => {
    if (!csvFile) return;
    if (!writableAccountId) {
      setWriteWarning('请先在右上角选择具体账户，再进行录入或导入提交。');
      return;
    }
    try {
      setWriteWarning(null);
      setCsvCommitting(true);
      const committed = await portfolioApi.commitCsvImport(writableAccountId, selectedBroker, csvFile, csvDryRun, importEventType);
      setCsvCommitResult(committed);
      if (!csvDryRun) {
        await refreshPortfolioData();
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setCsvCommitting(false);
    }
  };

  const openDeleteDialog = (item: PendingDelete) => {
    if (!writableAccountId) {
      setWriteWarning('请先在右上角选择具体账户，再进行删除修正。');
      return;
    }
    setPendingDelete(item);
  };

  const openAccountDeleteDialog = () => {
    if (!writableAccount) {
      setWriteWarning('请先选择具体账户，再删除持仓账户。');
      return;
    }
    setPendingAccountDelete({
      accountId: writableAccount.id,
      accountName: writableAccount.name,
    });
  };

  const handleConfirmAccountDelete = async () => {
    if (!pendingAccountDelete || accountDeleteLoading) return;

    try {
      setAccountDeleteLoading(true);
      setWriteWarning(null);
      await portfolioApi.deleteAccount(pendingAccountDelete.accountId);
      const nextAccount = accounts.find((item) => item.id !== pendingAccountDelete.accountId);
      setSelectedAccount(nextAccount?.id ?? 'all');
      setPendingAccountDelete(null);
      setShowCreateAccount(!nextAccount);
      await loadAccounts();
      setEventPage(1);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setAccountDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleteLoading) return;

    const nextPage = currentEventCount === 1 && eventPage > 1 ? eventPage - 1 : eventPage;
    try {
      setDeleteLoading(true);
      setWriteWarning(null);
      if (pendingDelete.eventType === 'trade') {
        await portfolioApi.deleteTrade(pendingDelete.id);
      } else if (pendingDelete.eventType === 'cash') {
        await portfolioApi.deleteCashLedger(pendingDelete.id);
      } else if (pendingDelete.eventType === 'corporate') {
        await portfolioApi.deleteCorporateAction(pendingDelete.id);
      } else if (pendingDelete.eventType === 'account') {
        await portfolioApi.deleteAccount(pendingDelete.id);
        await loadAccounts();
        if (selectedAccount === pendingDelete.id) {
          setSelectedAccount('all');
        }
      }
      setPendingDelete(null);
      if (pendingDelete.eventType !== 'account') {
        await refreshPortfolioData(nextPage);
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = accountForm.name.trim();
    if (!name) {
      setAccountCreateError('账户名称不能为空。');
      setAccountCreateSuccess(null);
      return;
    }
    try {
      setAccountCreating(true);
      setAccountCreateError(null);
      setAccountCreateSuccess(null);
      const created = await portfolioApi.createAccount({
        name,
        broker: accountForm.broker.trim() || undefined,
        market: accountForm.market,
        baseCurrency: accountForm.baseCurrency.trim() || 'CNY',
        accountType: accountForm.accountType,
      });
      await loadAccounts();
      setSelectedAccount(created.id);
      setShowCreateAccount(false);
      setWriteWarning(null);
      setAccountForm({
        name: '',
        broker: 'Demo',
        market: accountForm.market,
        baseCurrency: accountForm.baseCurrency,
        accountType: 'real',
      });
      setAccountCreateSuccess('账户创建成功，已自动切换到该账户。');
    } catch (err) {
      const parsed = getParsedApiError(err);
      setAccountCreateError(parsed.message || '创建账户失败，请稍后重试。');
      setAccountCreateSuccess(null);
    } finally {
      setAccountCreating(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadAccounts(), loadSnapshotAndRisk(), loadEvents(), loadBrokers()]);
  };

  const handleToggleMatchDetails = useCallback(async (symbol: string) => {
    const accountId = selectedAccount === 'all' ? (accounts[0]?.id ?? 0) : selectedAccount;
    if (!accountId) return;

    if (expandedMatchSymbol === symbol) {
      setExpandedMatchSymbol(null);
      setMatchData(null);
      return;
    }

    setExpandedMatchSymbol(symbol);
    if (!stockNotes.hasOwnProperty(symbol)) {
      loadStockNote(symbol);
    }
    setMatchLoading(true);  
    try {
      const data = await portfolioApi.getTradeMatches(accountId, { symbol, costMethod });
      setMatchData(data);
    } catch (err) {
      setMatchData(null);
    } finally {
      setMatchLoading(false);
    }
  }, [selectedAccount, accounts, expandedMatchSymbol, costMethod]);
  const loadStockNote = useCallback(async (symbol: string) => {
    setStockNoteLoaded(prev => ({ ...prev, [symbol]: undefined }));
    try {
      const res: any = await portfolioApi.getNote({ accountId: selectedAccount === 'all' ? (accounts[0]?.id ?? 0) : selectedAccount, symbol, costMethod });
      setStockNotes(prev => ({ ...prev, [symbol]: res.content || '' }));
      if (res.updatedAt) {
        setStockNoteLastSaved(prev => ({ ...prev, [symbol]: res.updatedAt! }));
      }
    } catch {
      const localKey = `stock_note_${symbol}`;
      const localVal = localStorage.getItem(localKey);
      if (localVal) {
        setStockNotes(prev => ({ ...prev, [symbol]: localVal }));
        const accountId = selectedAccount === 'all' ? (accounts[0]?.id ?? 0) : selectedAccount;
        portfolioApi.saveNote({ accountId, symbol, costMethod, content: localVal }).then(() => {
          localStorage.removeItem(localKey);
        }).catch(() => {});
      }
    } finally {
      setStockNoteLoaded(prev => ({ ...prev, [symbol]: true }));
    }
  }, [selectedAccount, accounts, costMethod]);

  const handleSaveNote = useCallback(async (symbol: string, silent = false) => {
    const content = stockNotes[symbol] || '';
    setStockNoteSaving(prev => ({ ...prev, [symbol]: true }));
    try {
      await portfolioApi.saveNote({
        accountId: selectedAccount === 'all' ? (accounts[0]?.id ?? 0) : selectedAccount,
        symbol, costMethod, content,
      });
      const now = new Date();
      const ds = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      setStockNoteLastSaved(prev => ({ ...prev, [symbol]: ds }));
      localStorage.removeItem(`stock_note_${symbol}`);
      if (!silent) {
        setStockNoteSaved(prev => ({ ...prev, [symbol]: true }));
        setTimeout(() => setStockNoteSaved(prev => ({ ...prev, [symbol]: false })), 2000);
      }
    } catch {
      localStorage.setItem(`stock_note_${symbol}`, content);
    } finally {
      setStockNoteSaving(prev => ({ ...prev, [symbol]: false }));
    }
  }, [stockNotes, selectedAccount, accounts, costMethod]);

  const handleExport = useCallback(async () => {
    if (exportLoading) return; // Prevent multiple clicks
    
    try {
      setExportLoading(true);
      let blob: Blob;
      let filename: string;

      if (eventType === 'trade') {
        blob = await portfolioApi.exportTrades({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          side: eventSide || undefined,
        });
        filename = `trades_export_${eventDateFrom || 'all'}_to_${eventDateTo || 'all'}.csv`;
      } else if (eventType === 'cash') {
        blob = await portfolioApi.exportCashLedger({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          direction: eventDirection || undefined,
        });
        filename = `cash_ledger_export_${eventDateFrom || 'all'}_to_${eventDateTo || 'all'}.csv`;
      } else {
        blob = await portfolioApi.exportCorporateActions({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          actionType: eventActionType || undefined,
        });
        filename = `corporate_actions_export_${eventDateFrom || 'all'}_to_${eventDateTo || 'all'}.csv`;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setExportLoading(false);
    }
  }, [eventType, queryAccountId, eventDateFrom, eventDateTo, eventSymbol, eventSide, eventDirection, eventActionType, exportLoading]);

  const reloadSnapshotAndRiskForScope = useCallback(async (
    requestedViewKey: string,
    requestedRequestId: number,
    requestedAccountId: number | undefined,
    requestedCostMethod: PortfolioCostMethod,
  ): Promise<boolean> => {
    if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
      return false;
    }

    setRiskWarning(null);

    try {
      const snapshotData = await portfolioApi.getSnapshot({
        accountId: requestedAccountId,
        costMethod: requestedCostMethod,
      });
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return false;
      }
      setSnapshot(snapshotData);
      setError(null);

      try {
        const riskData = await portfolioApi.getRisk({
          accountId: requestedAccountId,
          costMethod: requestedCostMethod,
        });
        if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
          return false;
        }
        setRisk(riskData);
        setRiskWarning(null);
      } catch (riskErr) {
        if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
          return false;
        }
        setRisk(null);
        const parsed = getParsedApiError(riskErr);
        setRiskWarning(parsed.message || '风险数据获取失败，已降级为仅展示快照数据。');
      }
      return true;
    } catch (err) {
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return false;
      }
      setSnapshot(null);
      setRisk(null);
      setError(getParsedApiError(err));
      return false;
    }
  }, []);

  const handleRefreshFx = async () => {
    if (!hasAccounts || isLoading || fxRefreshing) {
      return;
    }

    const requestedViewKey = refreshViewKey;
    const requestedAccountId = queryAccountId;
    const requestedCostMethod = costMethod;
    const requestedRequestId = refreshContextRef.current.requestId + 1;
    refreshContextRef.current = {
      viewKey: requestedViewKey,
      requestId: requestedRequestId,
    };

    try {
      setFxRefreshing(true);
      setFxRefreshFeedback(null);
      const result = await portfolioApi.refreshFx({
        accountId: requestedAccountId,
      });
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return;
      }
      const reloaded = await reloadSnapshotAndRiskForScope(
        requestedViewKey,
        requestedRequestId,
        requestedAccountId,
        requestedCostMethod,
      );
      if (!reloaded || !isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return;
      }
      setFxRefreshFeedback(buildFxRefreshFeedback(result));
    } catch (err) {
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return;
      }
      setError(getParsedApiError(err));
    } finally {
      if (isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        setFxRefreshing(false);
      }
    }
  };

  const loadBackupStatus = useCallback(async () => {
    try {
      const data = await portfolioApi.getBackupStatus();
      setBackupStatus(data);
    } catch {
      // 静默失败，备份状态非关键
    }
  }, []);

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      const data = await portfolioApi.triggerBackup();
      setBackupMessageTone(data.success ? 'success' : 'warning');
      setBackupMessage(data.message as string);
      await loadBackupStatus();
    } catch (err: any) {
      setBackupMessageTone('danger');
      setBackupMessage(err?.message || '备份失败');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSync = async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      const data = await portfolioApi.triggerSync();
      setBackupMessageTone(data.success ? 'success' : (data.conflictCount as number) > 0 ? 'warning' : 'danger');
      setBackupMessage(data.message as string);
      await loadBackupStatus();
    } catch (err: any) {
      setBackupMessageTone('danger');
      setBackupMessage(err?.message || '同步失败');
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    void loadBackupStatus();
  }, [loadBackupStatus]);

  return (
    <div className="portfolio-page min-h-screen space-y-4 p-4 md:p-6">
      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">{text.title}</h1>
          <p className="text-xs md:text-sm text-secondary">
            {text.description}
          </p>
        </div>
        {hasAccounts ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px_280px] gap-2 items-end">
              <div>
                <p className="text-xs text-secondary mb-1">{text.accountView}</p>
                <div className="flex gap-2">
                  <select
                    value={String(selectedAccount)}
                    onChange={(e) => setSelectedAccount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className={PORTFOLIO_SELECT_CLASS}
                  >
                    <option value="all">{text.allAccounts}</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} (#{account.id})
                      </option>
                    ))}
                  </select>
                  {selectedAccount !== 'all' ? (
                    <button
                      type="button"
                      className="btn-secondary !px-3 !text-xs shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        const acc = accounts.find((a) => a.id === selectedAccount);
                        if (acc) {
                          openDeleteDialog({
                            eventType: 'account',
                            id: acc.id,
                            name: acc.name,
                            message: `确认删除账户「${acc.name}」吗？该操作将同时删除该账户下的所有交易记录、资金流水和公司行为数据，且不可恢复。`,
                          });
                        }
                      }}
                    >
                      删除账户
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">{text.costMethod}</p>
                <select
                  value={costMethod}
                  onChange={(e) => setCostMethod(e.target.value as PortfolioCostMethod)}
                  className={PORTFOLIO_SELECT_CLASS}
                >
                  <option value="fifo">{text.fifo}</option>
                  <option value="avg">{text.avg}</option>
                  <option value="profit_priority">盈利优先（PP）</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm flex-1"
                  onClick={() => {
                    setShowCreateAccount((prev) => !prev);
                    setAccountCreateError(null);
                    setAccountCreateSuccess(null);
                  }}
                >
                  {showCreateAccount ? text.collapseCreate : text.createAccount}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={isLoading || fxRefreshing}
                  className="btn-secondary text-sm flex-1"
                >
                  {isLoading ? text.refreshing : text.refreshData}
                </button>
                <button
                  type="button"
                  onClick={openAccountDeleteDialog}
                  disabled={!canDeleteSelectedAccount}
                  className="btn-secondary text-sm flex-1 border-red-400/40 text-red-100 hover:bg-red-500/15 disabled:border-white/10 disabled:text-secondary"
                >
                  {accountDeleteLoading ? text.deletingAccount : text.deleteAccount}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <InlineAlert
            variant="warning"
            className="inline-block rounded-lg px-3 py-2 text-xs shadow-none"
            message={text.noAccounts}
          />
        )}
      </section>

      {error ? <ApiErrorAlert error={error} onDismiss={() => setError(null)} /> : null}
      {riskWarning ? (
        <InlineAlert
          variant="warning"
          title={text.riskDegraded}
          message={riskWarning}
        />
      ) : null}
      {writeWarning ? (
        <InlineAlert
          variant="warning"
          title={text.operationHint}
          message={writeWarning}
        />
      ) : null}
      {positionAnalysisMessage ? (
        <InlineAlert
          variant="success"
          title={text.analysisTask}
          message={positionAnalysisMessage}
        />
      ) : null}

      {(showCreateAccount || !hasAccounts) ? (
        <Card padding="md">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">新建账户</h2>
            {hasAccounts ? (
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-1"
                onClick={() => {
                  setShowCreateAccount(false);
                  setAccountCreateError(null);
                  setAccountCreateSuccess(null);
                }}
              >
                收起
              </button>
            ) : (
              <span className="text-xs text-secondary">创建后自动切换到该账户</span>
            )}
          </div>
          {accountCreateError ? (
            <InlineAlert
              variant="danger"
              className="mt-2 rounded-lg px-2 py-1 text-xs shadow-none"
              title="创建账户失败"
              message={accountCreateError}
            />
          ) : null}
          {accountCreateSuccess ? (
            <InlineAlert
              variant="success"
              className="mt-2 rounded-lg px-2 py-1 text-xs shadow-none"
              title="创建账户成功"
              message={accountCreateSuccess}
            />
          ) : null}
          <form className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2" onSubmit={handleCreateAccount}>
            <input
              className={`${PORTFOLIO_INPUT_CLASS} md:col-span-2`}
              placeholder="账户名称（必填）"
              value={accountForm.name}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className={PORTFOLIO_INPUT_CLASS}
              placeholder="券商（可选，如 Demo/华泰）"
              value={accountForm.broker}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, broker: e.target.value }))}
            />
            <input
              className={PORTFOLIO_INPUT_CLASS}
              placeholder="基准币（如 CNY/USD/HKD）"
              value={accountForm.baseCurrency}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))}
            />
            <select
              className={PORTFOLIO_SELECT_CLASS}
              value={accountForm.market}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, market: e.target.value as 'cn' | 'hk' | 'us' }))}
            >
              <option value="cn">市场：A 股（cn）</option>
              <option value="hk">市场：港股（hk）</option>
              <option value="us">市场：美股（us）</option>
            </select>
            <select
              className={PORTFOLIO_SELECT_CLASS}
              value={accountForm.accountType}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, accountType: e.target.value as 'real' | 'simulation' }))}
            >
              <option value="real">账户类型：真实账户</option>
              <option value="simulation">账户类型：模拟账户</option>
            </select>
            <button type="submit" className="btn-secondary text-sm" disabled={accountCreating}>
              {accountCreating ? '创建中...' : '创建账户'}
            </button>
          </form>
        </Card>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card variant="gradient" padding="md">
          <p className="text-xs text-secondary">{text.totalEquity}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(snapshot?.totalEquity, snapshot?.currency || 'CNY')}</p>
        </Card>
        <Card variant="gradient" padding="md">
          <p className="text-xs text-secondary">{text.totalMarketValue}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(snapshot?.totalMarketValue, snapshot?.currency || 'CNY')}</p>
        </Card>
        <Card variant="gradient" padding="md">
          <p className="text-xs text-secondary">{text.totalCash}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(snapshot?.totalCash, snapshot?.currency || 'CNY')}</p>
        </Card>
        <Card variant="gradient" padding="md">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-secondary">{text.fxStatus}</p>
            <button
              type="button"
              className="btn-secondary !px-3 !py-1 !text-xs shrink-0"
              onClick={() => void handleRefreshFx()}
              disabled={!hasAccounts || isLoading || fxRefreshing}
            >
              {fxRefreshing ? text.refreshing : text.refreshFx}
            </button>
          </div>
          <div className="mt-2">{snapshot?.fxStale ? <Badge variant="warning">{text.stale}</Badge> : <Badge variant="success">{text.latest}</Badge>}</div>
          {fxRefreshFeedback ? (
            <InlineAlert
              variant={getFxRefreshFeedbackVariant(fxRefreshFeedback.tone)}
              title={text.fxRefreshResult}
              message={fxRefreshFeedback.text}
              className="mt-3 rounded-xl px-3 py-2 text-xs shadow-none"
            />
          ) : null}
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">{text.positionsTitle}</h2>
            <span className="text-xs text-secondary">{formatUiText(text.countItems, { count: positionRows.length })}</span>
          </div>
          {positionRows.length === 0 ? (
            <EmptyState
              title={text.noPositionsTitle}
              description={text.noPositionsDescription}
              className="border-none bg-transparent px-4 py-8 shadow-none"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-secondary border-b border-white/10">
                  <tr>
                    {selectedAccount === 'all' ? null : (
                      <th className="text-left py-2 pr-2">{text.account}</th>
                    )}
                    <th className="text-left py-2 pr-2">{text.code}</th>
                    <th className="text-right py-2 pr-2">{text.quantity}</th>
                    <th className="text-right py-2 pr-2">{text.avgCost}</th>
                    <th className="text-right py-2 pr-2">{text.lastPrice}</th>
                    <th className="text-right py-2 pr-2">{text.marketValue}</th>
                    <th className="text-right py-2 pr-2">{text.unrealizedPnl}</th>
                    <th className="text-right py-2 pr-2">已实现盈亏</th>
                    <th className="text-right py-2 pr-2">{text.returnPct}</th>
                    <th className="text-right py-2">{text.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.map((row) => {
                    const isExpanded = expandedMatchSymbol === row.symbol;
                    const isMatchLoading = isExpanded && matchLoading;
                    const rowMatchData = isExpanded ? matchData : null;
                    const rowKey = `${row.accountId}-${row.symbol}-${row.market}`;
                    const analyzing = positionAnalysisLoadingKey === rowKey;

                    return (
                      <>
                        <tr
                          className={`border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}
                          onClick={() => handleToggleMatchDetails(row.symbol)}
                          title="点击查看交易匹配详情"
                        >
                          {selectedAccount === 'all' ? null : (
                            <td className="py-2 pr-2 text-secondary">{row.accountName}</td>
                          )}
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-1">
                              <span className="text-foreground">{(row as any).stockName || row.symbol}</span>
                              <svg className={`w-3 h-3 text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            {(row as any).stockName && <div className="text-[11px] text-secondary font-mono">{row.symbol}</div>}
                          </td>
                          <td className="py-2 pr-2 text-right">{row.quantity.toFixed(2)}</td>
                          <td className="py-2 pr-2 text-right">{row.avgCost.toFixed(4)}</td>
                          <td className="py-2 pr-2 text-right">
                            <div>{formatPositionPrice(row)}</div>
                            <div className={`text-[11px] ${hasPositionPrice(row) ? 'text-secondary' : 'text-warning'}`}>
                              {getPositionPriceLabel(row)}
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right">{formatPositionMoney(row.marketValueBase, row)}</td>
                          <td
                            className={`py-2 pr-2 text-right ${
                              hasPositionPrice(row)
                                ? row.unrealizedPnlBase >= 0
                                  ? 'text-danger'
                                  : 'text-success'
                                : 'text-secondary'
                            }`}
                          >
                            {formatPositionMoney(row.unrealizedPnlBase, row)}
                          </td>
                          <td
                            className={`py-2 pr-2 text-right ${
                              (row as any).realizedPnlBase !== null && (row as any).realizedPnlBase !== undefined
                                ? (row as any).realizedPnlBase >= 0
                                  ? 'text-danger'
                                  : 'text-success'
                                : 'text-secondary'
                            }`}
                          >
                            {formatPositionMoney((row as any).realizedPnlBase || 0, { ...row, priceAvailable: true })}
                          </td>
                          <td
                            className={`py-2 text-right ${
                              hasPositionPrice(row) && row.unrealizedPnlPct !== null && row.unrealizedPnlPct !== undefined
                                ? row.unrealizedPnlPct >= 0
                                  ? 'text-danger'
                                  : 'text-success'
                                : 'text-secondary'
                            }`}
                          >
                            {formatSignedPct(row.unrealizedPnlPct)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleAnalyzePosition(row); }}
                              disabled={analyzing}
                              className="btn-secondary px-2 py-1 text-xs disabled:cursor-wait disabled:opacity-60"
                            >
                              {analyzing ? text.submitting : text.analyze}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-white/5">
                            <td colSpan={selectedAccount === 'all' ? 10 : 11} className="py-3 px-4 bg-white/[0.02]">
                              {isMatchLoading ? (
                                <div className="text-center text-secondary text-xs py-4">加载中...</div>
                              ) : (rowMatchData && (rowMatchData.matchedPairs || rowMatchData.unmatchedLots || rowMatchData.unmatchedSells)) ? (
                                <div className="space-y-3">
                                                                    <div className="stock-note-section">
                                    <div className="stock-note-header">
                                      <span className="stock-note-label">📝 操作笔记</span>
                                      {stockNoteLoaded[row.symbol] === undefined && (
                                        <span className="stock-note-status loading">⏳ 加载中…</span>
                                      )}
                                      {stockNoteLastSaved[row.symbol] && (
                                        <span className="stock-note-saved-at">上次保存: {stockNoteLastSaved[row.symbol]}</span>
                                      )}
                                    </div>
                                    {stockNoteEditing[row.symbol] ? (
                                      <>
                                        <textarea
                                          className="stock-note-textarea"
                                          rows={6}
                                          placeholder="记录该股票的操作想法、关键事件、后续计划…"
                                          value={stockNotes[row.symbol] || ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setStockNotes(prev => ({ ...prev, [row.symbol]: value }));
                                          }}
                                        />
                                        <div className="stock-note-footer">
                                          <div className="stock-note-info">
                                            {stockNoteSaved[row.symbol] && (
                                              <span className="stock-note-saved-badge">✅ 已保存</span>
                                            )}
                                          </div>
                                          <div className="stock-note-actions">
                                            <button
                                              className="btn-secondary stock-note-action-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setStockNoteEditing(prev => ({ ...prev, [row.symbol]: false }));
                                              }}
                                            >
                                              取消
                                            </button>
                                            <button
                                              className="btn-primary stock-note-action-btn"
                                              disabled={stockNoteSaving[row.symbol]}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveNote(row.symbol);
                                                setStockNoteEditing(prev => ({ ...prev, [row.symbol]: false }));
                                              }}
                                            >
                                              {stockNoteSaving[row.symbol] ? '⏳ 保存中…' : '💾 保存'}
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="stock-note-preview">
                                          {stockNotes[row.symbol] ? (
                                            <div className="stock-note-content">{stockNotes[row.symbol]}</div>
                                          ) : (
                                            <div className="stock-note-empty">暂无笔记，点击"编辑"开始记录</div>
                                          )}
                                        </div>
                                        <div className="stock-note-footer">
                                          <div className="stock-note-info" />
                                          <div className="stock-note-actions">
                                            <button
                                              className="btn-primary stock-note-action-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setStockNoteEditing(prev => ({ ...prev, [row.symbol]: true }));
                                              }}
                                            >
                                              ✏️ 编辑
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>                                  
                                  {(rowMatchData.matchedPairs || []).length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-foreground mb-2">
                                        ✅ 已匹配交易 ({(rowMatchData.matchedPairs || []).length} 对)
                                      </div>
                                      <div className="space-y-1.5">
                                        {(rowMatchData.matchedPairs || []).map((m: TradeMatchItem, idx: number) => (
                                          <div key={idx} className="flex items-center gap-3 text-xs bg-white/5 rounded-lg px-3 py-2">
                                            <span className="text-secondary">买入 {m.buyDate}</span>
                                            <span className="text-foreground">{m.matchedQty.toFixed(0)}股 @{m.buyPrice.toFixed(4)}</span>
                                            <span className="text-secondary">→</span>
                                            <span className="text-secondary">卖出 {m.sellDate}</span>
                                            <span className="text-foreground">{m.matchedQty.toFixed(0)}股 @{m.sellPrice.toFixed(4)}</span>
                                            <span className={`font-semibold ${m.realizedPnl >= 0 ? 'text-danger' : 'text-success'}`}>
                                              {m.realizedPnl >= 0 ? '+' : ''}{m.realizedPnl.toFixed(2)} ({m.realizedPnlPct >= 0 ? '+' : ''}{m.realizedPnlPct.toFixed(2)}%)
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(rowMatchData.unmatchedLots || []).length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-foreground mb-2">
                                        📦 未匹配持仓 ({(rowMatchData.unmatchedLots || []).length} 批)
                                      </div>
                                      <div className="space-y-1.5">
                                        {(rowMatchData.unmatchedLots || []).map((u: UnmatchedLotItem, idx: number) => (
                                          <div key={idx} className="flex items-center gap-3 text-xs bg-white/5 rounded-lg px-3 py-2">
                                            <span className="text-secondary">买入 {u.buyDate}</span>
                                            <span className="text-foreground">{u.remainingQuantity.toFixed(0)}股 @{u.unitCost.toFixed(4)}</span>
                                            <span className="text-secondary">
                                              成本 {u.totalCost.toFixed(2)} | 保本价: {u.breakevenPrice.toFixed(4)}
                                            </span>
                                            <span className="text-warning">
                                              💡 建议卖出价: {(u.breakevenPrice * 1.05).toFixed(4)} (+5%)
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(rowMatchData.unmatchedSells || []).length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-foreground mb-2">
                                        🔻 未匹配卖出 ({(rowMatchData.unmatchedSells || []).length} 笔)
                                      </div>
                                      <div className="space-y-1.5">
                                        {(rowMatchData.unmatchedSells || []).map((s: UnmatchedSellLotItem, idx: number) => (
                                          <div key={idx} className="flex items-center gap-3 text-xs bg-white/5 rounded-lg px-3 py-2">
                                            <span className="text-secondary">卖出 {s.sellDate}</span>
                                            <span className="text-foreground">{s.remainingQuantity.toFixed(0)}股 @{s.sellPrice.toFixed(4)}</span>
                                            <span className="text-warning">
                                              ⚠️ 待低价买入匹配 | 建议买入价: {(s.sellPrice * 0.95).toFixed(4)} (-5%)
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(rowMatchData.matchedPairs || []).length === 0 && (rowMatchData.unmatchedLots || []).length === 0 && (rowMatchData.unmatchedSells || []).length === 0 && (
                                    <div className="text-center text-secondary text-xs py-2">暂无匹配数据</div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center text-secondary text-xs py-2">加载失败</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padding="md">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {concentrationMode === 'sector' ? text.sectorConcentration : text.positionConcentrationFallback}
          </h2>
          {concentrationPieData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={concentrationPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {concentrationPieData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title={text.noConcentrationTitle}
              description={text.noConcentrationDescription}
              className="border-none bg-transparent px-4 py-10 shadow-none"
            />
          )}
          <div className="mt-3 text-xs text-secondary space-y-1">
            <div>{text.displayScope}: {concentrationMode === 'sector' ? text.sectorDimension : text.positionDimensionFallback}</div>
            <div>{text.sectorAlert}: {risk?.sectorConcentration?.alert ? text.yes : text.no}</div>
            <div>{text.topWeight}: {formatPct(risk?.sectorConcentration?.topWeightPct ?? risk?.concentration?.topWeightPct)}</div>
          </div>
        </Card>
      </section>

      {writeBlocked && hasAccounts ? (
        <InlineAlert
          variant="warning"
          className="rounded-lg px-3 py-2 text-xs shadow-none"
          message={text.writeBlocked}
        />
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-2">{text.drawdownMonitor}</h3>
          <div className="text-xs text-secondary space-y-1">
            <div>{text.maxDrawdown}: {formatPct(risk?.drawdown?.maxDrawdownPct)}</div>
            <div>{text.currentDrawdown}: {formatPct(risk?.drawdown?.currentDrawdownPct)}</div>
            <div>{text.alert}: {risk?.drawdown?.alert ? text.yes : text.no}</div>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-2">{text.stopLossWarning}</h3>
          <div className="text-xs text-secondary space-y-1">
            <div>{text.triggeredCount}: {risk?.stopLoss?.triggeredCount ?? 0}</div>
            <div>{text.nearCount}: {risk?.stopLoss?.nearCount ?? 0}</div>
            <div>{text.alert}: {risk?.stopLoss?.nearAlert ? text.yes : text.no}</div>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-2">{text.scope}</h3>
          <div className="text-xs text-secondary space-y-1">
            <div>{text.accountCount}: {snapshot?.accountCount ?? 0}</div>
            <div>{text.currency}: {snapshot?.currency || 'CNY'}</div>
            <div>{text.costMethodShort}: {(snapshot?.costMethod || costMethod).toUpperCase()}</div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">手工录入：交易</h3>
          <form className="space-y-2" onSubmit={handleTradeSubmit}>
            <input className={PORTFOLIO_INPUT_CLASS} placeholder="股票代码（例如 600519）" value={tradeForm.symbol}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, symbol: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input className={PORTFOLIO_INPUT_CLASS} type="datetime-local" value={tradeForm.tradeDate}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, tradeDate: e.target.value }))} required />
              <select className={PORTFOLIO_SELECT_CLASS} value={tradeForm.side}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, side: e.target.value as PortfolioSide }))}>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.0001" placeholder="数量（必填）" value={tradeForm.quantity}
                onChange={(e) => {
                  const newQuantity = e.target.value;
                  setTradeForm((prev) => ({ ...prev, quantity: newQuantity }));
                  // 自动计算手续费
                  if (newQuantity && tradeForm.price) {
                    const calculatedFee = calculateFee(newQuantity, tradeForm.price, tradeForm.side);
                    if (calculatedFee) {
                      setTradeForm((prev) => ({ ...prev, fee: calculatedFee }));
                      setFeeAutoCalculated(true);
                    }
                  }
                }} required />
              <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.0001" placeholder="成交价（必填）" value={tradeForm.price}
                onChange={(e) => {
                  const newPrice = e.target.value;
                  setTradeForm((prev) => ({ ...prev, price: newPrice }));
                  // 自动计算手续费
                  if (tradeForm.quantity && newPrice) {
                    const calculatedFee = calculateFee(tradeForm.quantity, newPrice, tradeForm.side);
                    if (calculatedFee) {
                      setTradeForm((prev) => ({ ...prev, fee: calculatedFee }));
                      setFeeAutoCalculated(true);
                    }
                  }
                }} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.0001" placeholder="手续费（可选）" value={tradeForm.fee}
                  onChange={(e) => {
                    setTradeForm((prev) => ({ ...prev, fee: e.target.value }));
                    setFeeAutoCalculated(false);
                  }} />
                {feeAutoCalculated && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cyan/60">自动计算</span>
                )}
              </div>
              <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.0001" placeholder="税费（可选）" value={tradeForm.tax}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, tax: e.target.value }))} />
            </div>
            <p className="text-xs text-secondary">
              手续费可留空，系统将按 0 处理。
              {feeAutoCalculated && <span className="text-cyan ml-1">（已自动计算）</span>}
            </p>
            <button type="submit" className="btn-secondary w-full h-11 text-sm" disabled={!writableAccountId}>提交交易</button>
          </form>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">手工录入：资金流水</h3>
          <form className="space-y-2" onSubmit={handleCashSubmit}>
            <div className="grid grid-cols-2 gap-2">
              <input className={PORTFOLIO_INPUT_CLASS} type="datetime-local" value={cashForm.eventDate}
                onChange={(e) => setCashForm((prev) => ({ ...prev, eventDate: e.target.value }))} required />
              <select className={PORTFOLIO_SELECT_CLASS} value={cashForm.direction}
                onChange={(e) => setCashForm((prev) => ({ ...prev, direction: e.target.value as PortfolioCashDirection }))}>
                <option value="in">流入</option>
                <option value="out">流出</option>
              </select>
            </div>
            <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.0001" placeholder="金额"
              value={cashForm.amount} onChange={(e) => setCashForm((prev) => ({ ...prev, amount: e.target.value }))} required />
            <input className={PORTFOLIO_INPUT_CLASS} placeholder={`币种（可选，默认 ${writableAccount?.baseCurrency || '账户基准币'}）`} value={cashForm.currency}
              onChange={(e) => setCashForm((prev) => ({ ...prev, currency: e.target.value }))} />
            <button type="submit" className="btn-secondary w-full h-11 text-sm" disabled={!writableAccountId}>提交资金流水</button>
          </form>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">手工录入：公司行为</h3>
          <form className="space-y-2" onSubmit={handleCorporateSubmit}>
            <input className={PORTFOLIO_INPUT_CLASS} placeholder="股票代码" value={corpForm.symbol}
              onChange={(e) => setCorpForm((prev) => ({ ...prev, symbol: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input className={PORTFOLIO_INPUT_CLASS} type="datetime-local" value={corpForm.effectiveDate}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, effectiveDate: e.target.value }))} required />
              <select className={PORTFOLIO_SELECT_CLASS} value={corpForm.actionType}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, actionType: e.target.value as PortfolioCorporateActionType }))}>
                <option value="cash_dividend">现金分红</option>
                <option value="split_adjustment">拆并股调整</option>
              </select>
            </div>
            {corpForm.actionType === 'cash_dividend' ? (
              <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.000001" placeholder="每股分红"
                value={corpForm.cashDividendPerShare}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, cashDividendPerShare: e.target.value, splitRatio: '' }))} required />
            ) : (
              <input className={PORTFOLIO_INPUT_CLASS} type="number" min="0" step="0.000001" placeholder="拆并股比例"
                value={corpForm.splitRatio}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, splitRatio: e.target.value, cashDividendPerShare: '' }))} required />
            )}
            <button type="submit" className="btn-secondary w-full h-11 text-sm" disabled={!writableAccountId}>提交企业行为</button>
          </form>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-3">
        {/* 第一行：自动监盘 + 券商 CSV 导入 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {/* 自动监盘配置区域 */}
          <Card padding="md">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">自动监盘</h3>
              <div className="space-y-3">
                {/* 监盘开关和间隔 */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="monitor-enabled"
                      type="checkbox"
                      checked={monitorEnabled}
                      onChange={(e) => setMonitorEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-600 text-cyan focus:ring-cyan"
                    />
                    <label htmlFor="monitor-enabled" className="text-sm text-secondary">
                      启用自动监盘
                    </label>
                  </div>
                  {monitorEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary">检查间隔：</span>
                      <select
                        className="rounded-lg border border-white/10 bg-transparent px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan"
                        value={monitorInterval}
                        onChange={(e) => setMonitorInterval(e.target.value)}
                      >
                        <option value="1">1 分钟</option>
                        <option value="5">5 分钟</option>
                        <option value="15">15 分钟</option>
                        <option value="30">30 分钟</option>
                        <option value="60">60 分钟</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 规则添加表单 */}
                {monitorEnabled && (
                  <div className="space-y-2">
                    <div className="text-xs text-secondary">添加监盘规则：</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        className={PORTFOLIO_INPUT_CLASS}
                        placeholder="股票代码（如 600519）"
                        value={newRule.stockCode}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, stockCode: e.target.value }))}
                      />
                      <select
                        className={PORTFOLIO_SELECT_CLASS}
                        value={newRule.alertType}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, alertType: e.target.value as typeof newRule.alertType }))}
                      >
                        <option value="price_cross">价格突破</option>
                        <option value="price_change_percent">涨跌幅</option>
                        <option value="volume_spike">成交量异动</option>
                      </select>
                      {newRule.alertType === 'price_cross' && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className={PORTFOLIO_SELECT_CLASS}
                            value={newRule.direction}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, direction: e.target.value as typeof newRule.direction }))}
                          >
                            <option value="above">突破</option>
                            <option value="below">跌破</option>
                          </select>
                          <input
                            className={PORTFOLIO_INPUT_CLASS}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="价格"
                            value={newRule.price}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, price: e.target.value }))}
                          />
                        </div>
                      )}
                      {newRule.alertType === 'price_change_percent' && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className={PORTFOLIO_SELECT_CLASS}
                            value={newRule.direction === 'above' ? 'up' : 'down'}
                            onChange={(e) => setNewRule((prev) => ({
                              ...prev,
                              direction: e.target.value === 'up' ? 'above' : 'below'
                            }))}
                          >
                            <option value="up">涨幅</option>
                            <option value="down">跌幅</option>
                          </select>
                          <input
                            className={PORTFOLIO_INPUT_CLASS}
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="百分比"
                            value={newRule.changePct}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, changePct: e.target.value }))}
                          />
                        </div>
                      )}
                      {newRule.alertType === 'volume_spike' && (
                        <div className="grid grid-cols-2 gap-2">
                          <span className="flex items-center text-xs text-secondary">倍数</span>
                          <input
                            className={PORTFOLIO_INPUT_CLASS}
                            type="number"
                            min="1"
                            step="0.1"
                            placeholder="成交量倍数"
                            value={newRule.multiplier}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, multiplier: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                    <input
                      className={PORTFOLIO_INPUT_CLASS}
                      placeholder="备注（可选）"
                      value={newRule.description}
                      onChange={(e) => setNewRule((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-secondary w-full h-11 text-sm"
                      onClick={handleAddMonitorRule}
                      disabled={!newRule.stockCode.trim()}
                    >
                      添加规则
                    </button>
                  </div>
                )}

                {/* 规则列表 */}
                {monitorRules.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-secondary">当前规则（{monitorRules.length} 条）：</div>
                    <div className="max-h-48 overflow-auto rounded-lg border border-white/10 p-2 space-y-2">
                      {monitorRules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between gap-2 text-xs bg-white/5 p-2 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="text-foreground font-medium">{rule.stockCode}</div>
                            <div className="text-secondary truncate">
                              {rule.alertType === 'price_cross' && `${rule.direction === 'above' ? '突破' : '跌破'} ${rule.price}`}
                              {rule.alertType === 'price_change_percent' && `${rule.direction === 'up' ? '涨幅' : '跌幅'}超过 ${rule.changePct}%`}
                              {rule.alertType === 'volume_spike' && `成交量超过 ${rule.multiplier} 倍`}
                              {rule.description && ` - ${rule.description}`}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary !px-2 !py-1 !text-[10px] shrink-0"
                            onClick={() => handleRemoveMonitorRule(rule.id)}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 提示信息 */}
                {monitorEnabled && (
                  <div className="text-[11px] text-secondary">
                    监盘功能将在后台定时检查行情，触发告警后通过配置的通知渠道推送消息。
                  </div>
                )}
              </div>

              {/* 留白区域 - 为后续自动交易功能预留 */}
              <div className="min-h-[120px] rounded-lg border border-dashed border-white/10 flex items-center justify-center">
                <div className="text-center text-xs text-secondary">
                  <div className="mb-1">🚧 后续功能开发中</div>
                  <div className="text-[10px]">自动交易 / 券商软件联通</div>
                </div>
              </div>
            </div>
        </Card>

        {/* 右侧：券商 CSV 导入 + 事件记录 */}
        <Card padding="md">
          <div className="space-y-4">
            {/* 备份与同步 */}
            {backupStatus && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {text.backupTitle || '备份与同步'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!!backupStatus.cloudEnabled && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {text.cloudOn || '云端同步'}
                      </span>
                    )}
                    {(backupStatus.conflictCount as number) > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {text.conflict || '冲突'} {backupStatus.conflictCount as number}
                      </span>
                    )}
                  </div>
                </div>
                {!!backupStatus.lastLocalBackup && (
                  <div className="text-xs text-white/40 mb-2">
                    {text.lastBackup || '上次备份'}: {backupStatus.lastLocalBackup as string}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackup}
                    disabled={backupLoading}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs text-foreground hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {backupLoading ? (text.backingUp || '备份中...') : (text.backupNow || '立即备份')}
                  </button>
                  {!!backupStatus.cloudEnabled && (
                    <button
                      type="button"
                      onClick={handleSync}
                      disabled={backupLoading}
                      className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                    >
                      {backupLoading ? (text.syncing || '同步中...') : (text.syncNow || '同步云端')}
                    </button>
                  )}
                </div>
                {backupMessage && (
                  <InlineAlert
                    variant={getFxRefreshFeedbackVariant(backupMessageTone === 'danger' ? 'warning' : backupMessageTone)}
                    message={backupMessage}
                    className="mt-2 rounded-xl px-3 py-2 text-xs shadow-none"
                  />
                )}
              </div>
            )}
            {/* 券商 CSV 导入区域 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">券商 CSV 导入</h3>
              <div className="space-y-2">
                {brokerLoadWarning ? (
                  <InlineAlert
                    variant="warning"
                    className="rounded-lg px-2 py-1 text-xs shadow-none"
                    message={brokerLoadWarning}
                  />
                ) : null}
                <div className="grid grid-cols-3 gap-2">
                  <select className={PORTFOLIO_SELECT_CLASS} value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)}>
                    {brokers.length > 0 ? (
                      brokers.map((item) => <option key={item.broker} value={item.broker}>{formatBrokerLabel(item.broker, item.displayName)}</option>)
                    ) : (
                      <option value="huatai">huatai（华泰）</option>
                    )}
                  </select>
                  <select className={PORTFOLIO_SELECT_CLASS} value={importEventType} onChange={(e) => setImportEventType(e.target.value as 'trade' | 'cash' | 'corporate')}>
                    <option value="trade">交易流水</option>
                    <option value="cash">资金流水</option>
                    <option value="corporate">公司行为</option>
                  </select>
                  <label className={PORTFOLIO_FILE_PICKER_CLASS}>
                    选择 CSV
                    <input type="file" accept=".csv,.xls,.xlsx,.txt" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        setCsvFile(file);
                        setCsvParseResult(null);
                        setCsvCommitResult(null);
                      }} />
                  </label>
                </div>
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <input id="csv-dry-run" type="checkbox" checked={csvDryRun} onChange={(e) => setCsvDryRun(e.target.checked)} />
                  <label htmlFor="csv-dry-run">仅预演（不写入）</label>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary flex-1 h-11 text-sm" disabled={!csvFile || csvParsing} onClick={() => void handleParseCsv()}>
                    {csvParsing ? '解析中...' : '解析文件'}
                  </button>
                  <button type="button" className="btn-secondary flex-1 h-11 text-sm"
                    disabled={!csvFile || !writableAccountId || csvCommitting} onClick={() => void handleCommitCsv()}>
                    {csvCommitting ? '提交中...' : '提交导入'}
                  </button>
                </div>
                {csvParseResult ? (
                  <InlineAlert
                    variant={getCsvParseVariant(csvParseResult)}
                    title="CSV 解析结果"
                    message={`有效 ${csvParseResult.recordCount} 条，跳过 ${csvParseResult.skippedCount} 条，错误 ${csvParseResult.errorCount} 条。`}
                    className="rounded-lg px-3 py-2 text-xs shadow-none"
                  />
                ) : null}
                {csvCommitResult ? (
                  <div className="space-y-2">
                    <InlineAlert
                      variant={getCsvCommitVariant(csvCommitResult, csvDryRun)}
                      title={csvDryRun ? 'CSV 预演结果' : 'CSV 提交结果'}
                      message={`${csvDryRun ? '预演检查' : '实际写入'}：写入 ${csvCommitResult.insertedCount} 条，重复 ${csvCommitResult.duplicateCount} 条，失败 ${csvCommitResult.failedCount} 条。`}
                      className="rounded-lg px-3 py-2 text-xs shadow-none"
                    />
                    {csvCommitResult.failedCount > 0 && csvCommitResult.errors && csvCommitResult.errors.length > 0 && (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs">
                        <div className="font-semibold text-red-400 mb-1">失败详情（最多显示 20 条）：</div>
                        <div className="max-h-32 overflow-auto space-y-1 text-red-300/80">
                          {csvCommitResult.errors.map((err, idx) => (
                            <div key={idx} className="font-mono">{err}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-white/10"></div>

            {/* 事件记录区域 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">事件记录</h3>
              <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <select className={PORTFOLIO_SELECT_CLASS} value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                <option value="trade">交易流水</option>
                <option value="cash">资金流水</option>
                <option value="corporate">公司行为</option>
              </select>
              <button type="button" className="btn-secondary h-11 text-sm" onClick={() => void loadEvents()} disabled={eventLoading}>
                {eventLoading ? '加载中...' : '刷新流水'}
              </button>
              <button type="button" className="btn-secondary h-11 text-sm" onClick={() => void handleExport()} disabled={exportLoading}>
                {exportLoading ? '导出中...' : '导出 CSV'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={PORTFOLIO_INPUT_CLASS} type="date" value={eventDateFrom} onChange={(e) => setEventDateFrom(e.target.value)} />
              <input className={PORTFOLIO_INPUT_CLASS} type="date" value={eventDateTo} onChange={(e) => setEventDateTo(e.target.value)} />
            </div>
            {(eventType === 'trade' || eventType === 'corporate') ? (
              <input className={PORTFOLIO_INPUT_CLASS} placeholder="按股票代码筛选" value={eventSymbol}
                onChange={(e) => setEventSymbol(e.target.value)} />
            ) : null}
            {eventType === 'trade' ? (
              <select className={PORTFOLIO_SELECT_CLASS} value={eventSide} onChange={(e) => setEventSide(e.target.value as '' | PortfolioSide)}>
                <option value="">全部买卖方向</option>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            ) : null}
            {eventType === 'cash' ? (
              <select className={PORTFOLIO_SELECT_CLASS} value={eventDirection}
                onChange={(e) => setEventDirection(e.target.value as '' | PortfolioCashDirection)}>
                <option value="">全部资金方向</option>
                <option value="in">流入</option>
                <option value="out">流出</option>
              </select>
            ) : null}
            {eventType === 'corporate' ? (
              <select className={PORTFOLIO_SELECT_CLASS} value={eventActionType}
                onChange={(e) => setEventActionType(e.target.value as '' | PortfolioCorporateActionType)}>
                <option value="">全部公司行为</option>
                <option value="cash_dividend">现金分红</option>
                <option value="split_adjustment">拆并股调整</option>
              </select>
            ) : null}
            <div className="text-[11px] text-secondary">
              {writeBlocked ? '删除修正仅在单账户视图可用。请先选择具体账户后再删除错误流水。' : '如有错误流水，可直接删除后重新录入。'}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-white/10 p-2">
              {eventType === 'trade' && tradeEvents.map((item) => (
                <div key={`t-${item.id}`} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-xs text-secondary">
                  <div className="min-w-0">
                    {item.tradeDate} {formatSideLabel(item.side)} {item.symbol} 数量={item.quantity} 价格={item.price}
                  </div>
                  {!writeBlocked ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                      onClick={() => openDeleteDialog({
                        eventType: 'trade',
                        id: item.id,
                        message: `确认删除 ${item.tradeDate} 的${formatSideLabel(item.side)}流水 ${item.symbol}（数量 ${item.quantity}，价格 ${item.price}）吗？`,
                      })}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
              {eventType === 'cash' && cashEvents.map((item) => (
                <div key={`c-${item.id}`} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-xs text-secondary">
                  <div className="min-w-0">
                    {item.eventDate} {formatCashDirectionLabel(item.direction)} {item.amount} {item.currency}
                  </div>
                  {!writeBlocked ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                      onClick={() => openDeleteDialog({
                        eventType: 'cash',
                        id: item.id,
                        message: `确认删除 ${item.eventDate} 的资金流水（${formatCashDirectionLabel(item.direction)} ${item.amount} ${item.currency}）吗？`,
                      })}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
              {eventType === 'corporate' && corporateEvents.map((item) => (
                <div key={`ca-${item.id}`} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-xs text-secondary">
                  <div className="min-w-0">
                    {item.effectiveDate} {formatCorporateActionLabel(item.actionType)} {item.symbol}
                  </div>
                  {!writeBlocked ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                      onClick={() => openDeleteDialog({
                        eventType: 'corporate',
                        id: item.id,
                        message: `确认删除 ${item.effectiveDate} 的公司行为 ${formatCorporateActionLabel(item.actionType)}（${item.symbol}）吗？`,
                      })}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
              {!eventLoading
                && ((eventType === 'trade' && tradeEvents.length === 0)
                  || (eventType === 'cash' && cashEvents.length === 0)
                  || (eventType === 'corporate' && corporateEvents.length === 0)) ? (
                    <EmptyState
                      title="暂无流水"
                      description="调整筛选条件或先录入一笔交易、资金流水或公司行为。"
                      className="border-none bg-transparent px-3 py-6 shadow-none"
                    />
                  ) : null}
            </div>
            <div className="flex items-center justify-between text-xs text-secondary">
              <span>第 {eventPage} / {totalEventPages} 页</span>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs px-3 py-1" disabled={eventPage <= 1}
                  onClick={() => setEventPage((prev) => Math.max(1, prev - 1))}>
                  上一页
                </button>
                <button type="button" className="btn-secondary text-xs px-3 py-1" disabled={eventPage >= totalEventPages}
                  onClick={() => setEventPage((prev) => Math.min(totalEventPages, prev + 1))}>
                  下一页
                </button>
              </div>
            </div>
              </div>
            </div>
          </div>
        </Card>
        </div>
      </section>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="删除错误流水"
        message={pendingDelete?.message || '确认删除这条流水吗？'}
        confirmText={deleteLoading ? '删除中...' : '确认删除'}
        cancelText="取消"
        isDanger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) {
            setPendingDelete(null);
          }
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(pendingAccountDelete)}
        title={text.deleteAccountTitle}
        message={
          pendingAccountDelete
            ? formatUiText(text.deleteAccountMessage, {
              name: pendingAccountDelete.accountName,
              id: pendingAccountDelete.accountId,
            })
            : ''
        }
        confirmText={accountDeleteLoading ? text.deletingAccount : text.deleteAccountConfirm}
        isDanger
        onConfirm={() => void handleConfirmAccountDelete()}
        onCancel={() => {
          if (!accountDeleteLoading) {
            setPendingAccountDelete(null);
          }
        }}
      />
    </div>
  );
};

export default PortfolioPage;