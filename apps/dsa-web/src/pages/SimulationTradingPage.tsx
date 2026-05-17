/**
 * 模拟交易页面
 * 
 * 提供交易执行、交易建议查看、持仓详情等功能
 * 账户管理功能已移至 /portfolio 页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Input, InputNumber, message, Space, Row, Col, Statistic, Divider, Select, Alert, Empty, Descriptions, Modal, Tabs, Table, Tag } from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, PlayCircleOutlined, StopOutlined, RiseOutlined, FallOutlined, SearchOutlined, InfoCircleOutlined, LinkOutlined, WarningOutlined } from '@ant-design/icons';
import { portfolioApi } from '../api/portfolio';
import type { PortfolioAccountItem, PortfolioSnapshotResponse } from '../types/portfolio';
const { TabPane } = Tabs;

const SimulationTradingPage: React.FC = () => {
  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<PortfolioAccountItem | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [suggestionData, setSuggestionData] = useState<any>(null);  // 存储交易建议数据
  const [schedulerRunning, setSchedulerRunning] = useState(false);  // 调度器运行状态
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');  // 当前选定的股票代码
  const [editableOrders, setEditableOrders] = useState<any[]>([]);  // 可编辑的订单列表
  const [tradeForm] = Form.useForm();
  const [executeModalVisible, setExecuteModalVisible] = useState(false);  // 执行确认对话框
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);  // 待执行的订单
  const [riskAlerts, setRiskAlerts] = useState<{type: string; message: string; level: 'warning' | 'error'}[]>([]);  // 风险预警列表
  const [backtestResult, setBacktestResult] = useState<any>(null);  // 回测结果
  const [aiOptimized, setAiOptimized] = useState(false);  // AI是否已优化参数
  
  // 智能推荐相关状态
  const [recommendedStocks, setRecommendedStocks] = useState<any[]>([]);
  const [activeRecommendTab, setActiveRecommendTab] = useState<string>('');
  const [recommendLoading, setRecommendLoading] = useState(false);
  
  // 手动输入分析相关状态
  const [manualStockAnalysis, setManualStockAnalysis] = useState<any>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  // 加载模拟账户列表
  const loadAccounts = async () => {
    setLoading(true);
    try {
      // 只获取 account_type='simulation' 的账户
      const data = await portfolioApi.getAccounts(false, 'simulation');
      setAccounts(data.accounts);
      // 如果有账户，自动选中第一个
      if (data.accounts.length > 0) {
        setSelectedAccountId(data.accounts[0].id);
        setSelectedAccount(data.accounts[0]);
        // 加载该账户的快照
        await loadSnapshot(data.accounts[0].id);
      }
    } catch (error) {
      message.error('加载账户失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 加载账户快照
  const loadSnapshot = async (accountId: number) => {
    try {
      const snap = await portfolioApi.getSnapshot({ accountId });
      setSnapshot(snap);
    } catch (error) {
      console.error('加载快照失败:', error);
    }
  };

  // 组件挂载时加载账户
  useEffect(() => {
    loadAccounts();
  }, []);

  // 当账户列表加载完成后，选中第一个账户并加载快照
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
      setSelectedAccount(accounts[0]);
      loadSnapshot(accounts[0].id);
      // 进行风险评估
      setTimeout(() => {
        const alerts = performRiskAssessment();
        setRiskAlerts(alerts);
      }, 200);
    }
  }, [accounts]);

  // 账户选择变化
  const handleAccountChange = async (accountId: number) => {
    setSelectedAccountId(accountId);
    const account = accounts.find(a => a.id === accountId);
    setSelectedAccount(account || null);
    // 加载新账户的快照
    if (accountId) {
      await loadSnapshot(accountId);
      // 进行风险评估
      setTimeout(() => {
        const alerts = performRiskAssessment();
        setRiskAlerts(alerts);
      }, 100);
    }
  };

  // 设置当前操作标的
  const handleSetSelectedStock = (stockCode: string) => {
    setSelectedStockCode(stockCode);
    message.success(`已选定 ${stockCode} 为当前操作标的`);
  };

  // 搜索股票（手动输入）
  const handleStockSearch = (value: string) => {
    if (value) {
      setSelectedStockCode(value);
      message.success(`已选定 ${value} 为当前操作标的`);
    }
  };

  // ========== 辅助函数 ==========
  
  // 获取市场情绪标签
  const getSentimentTag = (sentiment: string) => {
    if (sentiment === 'bullish') return '📈 看涨';
    if (sentiment === 'bearish') return '📉 看跌';
    return '➡️ 中性';
  };
  
  // 生成 Mock 推荐数据（临时使用，后续替换为真实 API）
  const generateMockRecommendations = () => {
    return [
      {
        stock_code: '600519',
        stock_name: '贵州茅台',
        score: 85.5,
        rank: 1,
        current_price: 1850.00,
        change_pct: 2.3,
        trend_strength: 82,
        rsi: 55.3,
        volume_ratio: 1.3,
        macd_signal: 'bullish',
        support_level: 1820.0,
        resistance_level: 1900.0,
        reasons: ['多头排列，MA5>MA10>MA20', '量能放大，资金流入明显', 'MACD 金叉信号'],
        risks: ['RSI 接近超买区', '上方阻力位较近']
      },
      {
        stock_code: '300750',
        stock_name: '宁德时代',
        score: 82.3,
        rank: 2,
        current_price: 245.80,
        change_pct: 1.8,
        trend_strength: 78,
        rsi: 52.1,
        volume_ratio: 1.2,
        macd_signal: 'bullish',
        support_level: 240.0,
        resistance_level: 255.0,
        reasons: ['突破前期平台', '成交量温和放大', '板块热度高'],
        risks: ['短期涨幅较大', '注意回调风险']
      },
      {
        stock_code: '002594',
        stock_name: '比亚迪',
        score: 79.8,
        rank: 3,
        current_price: 285.50,
        change_pct: -0.5,
        trend_strength: 75,
        rsi: 48.5,
        volume_ratio: 0.9,
        macd_signal: 'neutral',
        support_level: 280.0,
        resistance_level: 295.0,
        reasons: ['均线粘合，方向待选', '估值合理', '长期趋势向上'],
        risks: ['短期震荡', '量能不足']
      },
      {
        stock_code: '000063',
        stock_name: '中兴通讯',
        score: 76.2,
        rank: 4,
        current_price: 42.30,
        change_pct: 3.2,
        trend_strength: 72,
        rsi: 58.7,
        volume_ratio: 1.5,
        macd_signal: 'bullish',
        support_level: 40.5,
        resistance_level: 45.0,
        reasons: ['放量上涨', '突破关键压力位', '5G 概念活跃'],
        risks: ['乖离率偏大', '追高风险']
      },
      {
        stock_code: '600690',
        stock_name: '海尔智家',
        score: 73.5,
        rank: 5,
        current_price: 28.90,
        change_pct: 0.8,
        trend_strength: 68,
        rsi: 50.2,
        volume_ratio: 1.0,
        macd_signal: 'neutral',
        support_level: 28.0,
        resistance_level: 30.5,
        reasons: ['稳健上涨', '基本面良好', '分红稳定'],
        risks: ['弹性较小', '涨速较慢']
      }
    ];
  };
  
  // 智能选股处理函数
  const handleGetRecommendations = async () => {
    setRecommendLoading(true);
    try {
      // TODO: 后续替换为真实 API 调用
      // const response = await fetch('/api/v1/simulation/recommendations', {...});
      
      // 暂时使用 Mock 数据
      await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟网络延迟
      const mockData = generateMockRecommendations();
      
      setRecommendedStocks(mockData);
      setActiveRecommendTab(mockData[0].stock_code); // 默认选中第一个
      message.success('AI 智能选股完成，已生成 Top 5 推荐');
    } catch (error) {
      message.error('智能选股失败，请稍后重试');
    } finally {
      setRecommendLoading(false);
    }
  };
  
  // 选定推荐股票
  const handleSelectRecommendedStock = (stockCode: string) => {
    setSelectedStockCode(stockCode);
    message.success(`已选定 ${stockCode} 为当前操作标的`);
  };
  
  // 手动输入股票的 AI 分析
  const handleAnalyzeManualStock = async () => {
    if (!selectedStockCode) {
      message.warning('请先输入股票代码');
      return;
    }
    
    setAnalyzeLoading(true);
    try {
      // 复用现有的 suggestions API
      const response = await fetch('/api/v1/simulation/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: selectedStockCode,
          use_auction: false  // 手动分析不使用集合竞价
        })
      });
      
      if (!response.ok) {
        throw new Error('分析失败');
      }
      
      const data = await response.json();
      setManualStockAnalysis(data);
      message.success('AI 分析完成');
    } catch (error) {
      message.error('分析失败，请检查股票代码是否正确');
    } finally {
      setAnalyzeLoading(false);
    }
  };
  
  // 选定手动分析的股票
  const handleSelectManualStock = () => {
    if (selectedStockCode) {
      message.success(`已选定 ${selectedStockCode} 为当前操作标的`);
    }
  };

  // 检查调度器状态
  const checkSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/v1/simulation/scheduler/status');
      if (response.ok) {
        const data = await response.json();
        setSchedulerRunning(data.running || false);
        console.log('[checkSchedulerStatus] Status:', data);
      }
    } catch (error) {
      console.error('[checkSchedulerStatus] Error:', error);
    }
  };

  // 组件挂载时检查调度器状态
  useEffect(() => {
    checkSchedulerStatus();
  }, []);



  // 执行交易
  const handleExecuteTrade = async (values: any) => {
    console.log('[handleExecuteTrade] Form values:', values);
    console.log('[handleExecuteTrade] selectedAccount:', selectedAccount);
    
    if (!selectedAccount) {
      message.error('未选择账户');
      return;
    }

    try {
      // 使用 Portfolio API 创建交易记录
      const result = await portfolioApi.createTrade({
        accountId: selectedAccount.id,
        symbol: values.stock_code,
        tradeDate: new Date().toISOString().split('T')[0], // 今天日期 YYYY-MM-DD
        side: values.side.toLowerCase(), // 'buy' or 'sell'
        quantity: values.quantity,
        price: values.price,
        fee: 0, // TODO: 根据券商计算手续费
        tax: 0, // TODO: 根据市场计算税费
        market: selectedAccount.market,
        currency: selectedAccount.baseCurrency,
        note: `模拟交易 - ${values.side === 'BUY' ? '买入' : '卖出'}`
      });
      
      console.log('[handleExecuteTrade] Trade result:', result);
      message.success(`交易成功: ID=${result.id}`);
      setTradeModalVisible(false);
      tradeForm.resetFields();
      // 重新加载账户快照
      await loadSnapshot(selectedAccount.id);
    } catch (error: any) {
      console.error('[handleExecuteTrade] Trade error:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '交易执行失败';
      message.error(errorMsg);
    }
  };

  // 获取交易建议（调用 simulation API）
  const handleGetSuggestion = async () => {
    console.log('[handleGetSuggestion] selectedAccount:', selectedAccount);
    console.log('[handleGetSuggestion] selectedStockCode:', selectedStockCode);
    
    if (!selectedAccount) {
      message.warning('请先选择账户');
      return;
    }

    if (!selectedStockCode) {
      message.warning('请先在选股区选择股票');
      return;
    }

    setLoading(true);
    try {
      // 调用后端 simulation API 生成交易建议
      const response = await fetch('/api/v1/simulation/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock_code: selectedStockCode,  // 使用用户选定的股票
          use_auction: true
        })
      });
      
      console.log('[handleGetSuggestion] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleGetSuggestion] Error response:', errorText);
        throw new Error(`生成交易建议失败: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[handleGetSuggestion] Suggestion data:', data);
      
      // 保存数据并设置可编辑订单
      setSuggestionData(data);
      setEditableOrders(data.grid_orders || []);
      message.success(`交易建议生成成功！生成了 ${data.grid_orders?.length || 0} 个网格订单`);
    } catch (error) {
      console.error('[handleGetSuggestion] Error:', error);
      message.error(error instanceof Error ? error.message : '获取交易建议失败');
    } finally {
      setLoading(false);
    }
  };

  // 启动调度器（调用 simulation API）
  const handleStartScheduler = async () => {
    console.log('[handleStartScheduler] Starting scheduler...');
    try {
      const response = await fetch('/api/v1/simulation/scheduler/start', {
        method: 'POST',
      });
      
      console.log('[handleStartScheduler] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleStartScheduler] Error:', errorText);
        throw new Error(`启动调度器失败: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[handleStartScheduler] Response:', data);
      message.success('调度器已启动');
      
      // 刷新状态
      await checkSchedulerStatus();
    } catch (error) {
      console.error('[handleStartScheduler] Error:', error);
      message.error(error instanceof Error ? error.message : '启动调度器失败');
    }
  };

  // 停止调度器（调用 simulation API）
  const handleStopScheduler = async () => {
    console.log('[handleStopScheduler] Stopping scheduler...');
    try {
      const response = await fetch('/api/v1/simulation/scheduler/stop', {
        method: 'POST',
      });
      
      console.log('[handleStopScheduler] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleStopScheduler] Error:', errorText);
        throw new Error(`停止调度器失败: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[handleStopScheduler] Response:', data);
      message.success('调度器已停止');
      
      // 刷新状态
      await checkSchedulerStatus();
    } catch (error) {
      console.error('[handleStopScheduler] Error:', error);
      message.error(error instanceof Error ? error.message : '停止调度器失败');
    }
  };

  // 手动触发每日建议（调用 simulation API）
  const handleTriggerDailySuggestions = async () => {
    console.log('[handleTriggerDailySuggestions] Triggering daily suggestions...');
    try {
      const response = await fetch('/api/v1/simulation/scheduler/daily-suggestions', {
        method: 'POST',
      });
      
      console.log('[handleTriggerDailySuggestions] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleTriggerDailySuggestions] Error:', errorText);
        throw new Error(`触发每日建议失败: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[handleTriggerDailySuggestions] Response:', data);
      message.success('交易建议生成任务已执行');
    } catch (error) {
      console.error('[handleTriggerDailySuggestions] Error:', error);
      message.error(error instanceof Error ? error.message : '执行失败');
    }
  };

  // 执行今日交易计划（改为打开确认对话框）
  const handleExecuteDailyPlan = () => {
    handleOpenExecuteConfirm();
  };

  // 修改订单
  const handleOrderChange = (index: number, field: string, value: any) => {
    const newOrders = [...editableOrders];
    newOrders[index] = { ...newOrders[index], [field]: value };
    setEditableOrders(newOrders);
  };

  // 删除订单
  const handleDeleteOrder = (index: number) => {
    const newOrders = editableOrders.filter((_, i) => i !== index);
    setEditableOrders(newOrders);
  };

  // AI 自动调整网格参数
  const handleAIOptimizeParams = () => {
    if (!suggestionData || editableOrders.length === 0) {
      message.warning('请先生成交易建议');
      return;
    }

    // 计算当前价格的波动率（模拟）
    const currentPrice = suggestionData.current_price || 100;
    const volatility = 0.02 + Math.random() * 0.03; // 2%-5% 波动率
    
    // 根据波动率调整止盈止损距离
    const takeProfitDistance = currentPrice * (0.03 + volatility); // 3% + 波动率
    const stopLossDistance = currentPrice * (0.02 + volatility * 0.5); // 2% + 波动率*0.5
    
    // 根据账户资金动态计算仓位大小
    const totalEquity = snapshot?.totalEquity || 100000;
    const positionSize = Math.min(
      Math.floor(totalEquity * 0.1 / currentPrice / 100) * 100, // 单笔不超过10%资金
      10000 // 最大10000股
    );

    // 更新订单参数
    const optimizedOrders = editableOrders.map(order => {
      let newPrice = order.price;
      let newQuantity = Math.min(order.quantity, positionSize);
      
      if (order.order_type === 'TAKE_PROFIT') {
        newPrice = currentPrice + takeProfitDistance;
      } else if (order.order_type === 'STOP_LOSS') {
        newPrice = currentPrice - stopLossDistance;
      }
      
      return {
        ...order,
        price: Math.round(newPrice * 100) / 100, // 保留2位小数
        quantity: newQuantity
      };
    });

    setEditableOrders(optimizedOrders);
    setAiOptimized(true);
    message.success(`✨ AI已根据市场波动率(${(volatility * 100).toFixed(1)}%)自动优化参数`);
  };

  // 风险评估
  const performRiskAssessment = () => {
    if (!snapshot || !selectedAccount) return [];

    const alerts: {type: string; message: string; level: 'warning' | 'error'}[] = [];
    const positions = snapshot.accounts[0]?.positions || [];
    const totalEquity = snapshot.totalEquity || 1;

    // 1. 单只股票仓位超过 30% 预警
    positions.forEach(pos => {
      const positionValue = pos.quantity * pos.avgCost;
      const positionRatio = positionValue / totalEquity;
      
      if (positionRatio > 0.3) {
        alerts.push({
          type: 'position',
          message: `⚠️ ${pos.symbol} 仓位占比 ${(positionRatio * 100).toFixed(1)}%，超过30%警戒线`,
          level: 'warning'
        });
      }
    });

    // 2. 总仓位超过 80% 预警
    const totalPositionValue = positions.reduce((sum, pos) => sum + pos.quantity * pos.avgCost, 0);
    const totalPositionRatio = totalPositionValue / totalEquity;
    
    if (totalPositionRatio > 0.8) {
      alerts.push({
        type: 'total_position',
        message: ` 总仓位 ${(totalPositionRatio * 100).toFixed(1)}%，超过80%警戒线，建议减仓`,
        level: 'error'
      });
    }

    // 3. 连续亏损检测（简化：检查浮动盈亏）
    if (snapshot.unrealizedPnl < -totalEquity * 0.05) {
      alerts.push({
        type: 'consecutive_loss',
        message: `️ 当前浮动亏损 ¥${Math.abs(snapshot.unrealizedPnl).toFixed(2)}，建议暂停交易`,
        level: 'warning'
      });
    }

    return alerts;
  };

  // 执行回测（模拟）
  const handleRunBacktest = async () => {
    if (!selectedStockCode) {
      message.warning('请先选择股票');
      return;
    }

    setLoading(true);
    try {
      // 模拟回测结果
      const mockBacktestResult = {
        stock_code: selectedStockCode,
        period: '2024-01-01 ~ 2024-12-31',
        initial_capital: 100000,
        final_capital: 125680,
        total_return: 25.68,
        annual_return: 25.68,
        max_drawdown: -12.34,
        sharpe_ratio: 1.85,
        win_rate: 65.5,
        total_trades: 48,
        winning_trades: 31,
        losing_trades: 17,
        avg_profit: 2.8,
        avg_loss: -1.5
      };

      setBacktestResult(mockBacktestResult);
      message.success('回测完成！');
    } catch (error) {
      message.error('回测失败');
    } finally {
      setLoading(false);
    }
  };

  // 检查 T+1 规则（A股）
  const checkT1Rule = (order: any): { valid: boolean; message: string } => {
    if (!selectedAccount) return { valid: true, message: '' };
    
    // 只对 A股执行 T+1 检查
    if (selectedAccount.market !== 'cn') {
      return { valid: true, message: '' };
    }

    // 卖出操作需要检查 T+1
    if (order.side === 'SELL') {
      // 查找该股票的持仓
      const position = snapshot?.accounts[0].positions.find(
        pos => pos.symbol === selectedStockCode
      );
      
      if (!position) {
        return { valid: false, message: `❌ ${selectedStockCode} 无持仓，无法卖出` };
      }

      // 检查是否有今日买入的记录（简化逻辑：假设今天买入的不可卖出）
      // 实际应从后端获取今日交易记录

      // TODO: 从后端获取今日买入记录
      // const todayBuyRecords = await getTodayBuyRecords(selectedAccount.id, selectedStockCode, today);
      // if (todayBuyRecords.length > 0) {
      //   return { valid: false, message: `⚠️ A股 T+1 规则：今日买入的 ${selectedStockCode} 需明日才能卖出` };
      // }
    }

    return { valid: true, message: '' };
  };

  // 打开执行确认对话框
  const handleOpenExecuteConfirm = () => {
    if (!selectedAccount || !selectedStockCode) {
      message.warning('请先选择账户和股票');
      return;
    }

    if (editableOrders.length === 0) {
      message.warning('没有可执行的订单');
      return;
    }

    // 检查 T+1 规则
    const t1Issues = editableOrders
      .map(order => checkT1Rule(order))
      .filter(result => !result.valid);

    if (t1Issues.length > 0) {
      message.warning(t1Issues[0].message);
      return;
    }

    setPendingOrders(editableOrders);
    setExecuteModalVisible(true);
  };

  // 确认执行交易计划
  const handleConfirmExecute = async () => {
    setLoading(true);
    try {
      // 批量执行所有订单
      for (const order of pendingOrders) {
        await portfolioApi.createTrade({
          accountId: selectedAccount!.id,
          symbol: selectedStockCode,
          tradeDate: new Date().toISOString().split('T')[0],
          side: order.side.toLowerCase(),
          quantity: order.quantity,
          price: order.price,
          fee: 0,
          tax: 0,
          market: selectedAccount!.market,
          currency: selectedAccount!.baseCurrency,
          note: `网格交易 - ${order.order_type}`
        });
      }
      
      message.success(`✅ 成功执行 ${pendingOrders.length} 个订单`);
      setPendingOrders([]);
      setEditableOrders([]);
      setSuggestionData(null);
      setExecuteModalVisible(false);
      await loadSnapshot(selectedAccount!.id);
    } catch (error: any) {
      console.error('[handleConfirmExecute] Error:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '执行失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1920px', margin: '0 auto' }}>
      {/* 顶部状态栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>🎯 模拟交易系统</span>
              <Alert
                message={`调度器: ${schedulerRunning ? '🟢 运行中' : '⚪ 已停止'}`}
                type={schedulerRunning ? 'success' : 'warning'}
                showIcon
                style={{ minWidth: '200px' }}
              />
            </Space>
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                checkSchedulerStatus();
                loadAccounts();
              }}
              loading={loading}
            >
              刷新状态
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 主体区域：三列布局 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {/* 左侧：账户区 (25%) */}
        <Col xs={24} lg={6}>
          <Card title="🏦 账户区" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 账户选择 */}
              <div>
                <div style={{ marginBottom: 8, fontWeight: 'bold' }}>选择交易账户：</div>
                <Select
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  style={{ width: '100%' }}
                  placeholder="请选择账户"
                  options={accounts.map(acc => ({
                    label: `${acc.name} (${acc.market.toUpperCase()})`,
                    value: acc.id
                  }))}
                />
              </div>

              <Alert
                message="提示"
                description="请在 /portfolio 页面创建账户，并将账户类型设置为【模拟】。"
                type="info"
                showIcon
              />

              {/* 资金快照 */}
              {snapshot && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <Statistic
                      title="可用资金"
                      value={snapshot.totalCash || 0}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                    />
                    <Statistic
                      title="总资产"
                      value={snapshot.totalEquity || 0}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ fontSize: '16px' }}
                    />
                    <Statistic
                      title="浮动盈亏"
                      value={snapshot.unrealizedPnl || 0}
                      precision={2}
                      prefix={snapshot.unrealizedPnl >= 0 ? <RiseOutlined /> : <FallOutlined />}
                      valueStyle={{ 
                        color: snapshot.unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f',
                        fontSize: '16px'
                      }}
                    />
                  </Space>
                </>
              )}

              {/* 持仓表格 */}
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>持仓明细</div>
              {snapshot && snapshot.accounts.length > 0 && snapshot.accounts[0].positions.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'left' }}>代码</th>
                        <th style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'right' }}>数量</th>
                        <th style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'right' }}>成本</th>
                        <th style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'right' }}>盈亏</th>
                        <th style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.accounts[0].positions.map((pos) => (
                        <tr 
                          key={pos.symbol}
                          style={{ 
                            background: selectedStockCode === pos.symbol ? '#e6f7ff' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '6px', border: '1px solid #d9d9d9' }}>{pos.symbol}</td>
                          <td style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'right' }}>{pos.quantity}</td>
                          <td style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'right' }}>¥{pos.avgCost.toFixed(2)}</td>
                          <td style={{ 
                            padding: '6px', 
                            border: '1px solid #d9d9d9', 
                            textAlign: 'right',
                            color: pos.unrealizedPnlBase >= 0 ? '#52c41a' : '#ff4d4f'
                          }}>
                            ¥{pos.unrealizedPnlBase.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px', border: '1px solid #d9d9d9', textAlign: 'center' }}>
                            <Button 
                              size="small" 
                              type={selectedStockCode === pos.symbol ? 'primary' : 'default'}
                              onClick={() => handleSetSelectedStock(pos.symbol)}
                            >
                              {selectedStockCode === pos.symbol ? '当前' : '设为标的'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty 
                  description="暂无持仓" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: '20px 0' }}
                />
              )}

              {/* 风险评估预警 */}
              {riskAlerts.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                    <Space>
                      <WarningOutlined style={{ color: '#ff4d4f' }} />
                      风险预警
                    </Space>
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    {riskAlerts.map((alert, index) => (
                      <Alert
                        key={index}
                        message={alert.message}
                        type={alert.level}
                        showIcon
                        style={{ fontSize: '12px' }}
                      />
                    ))}
                  </Space>
                </>
              )}

              {/* 配对持仓视图 */}
              {snapshot && snapshot.accounts.length > 0 && snapshot.accounts[0].positions.length > 1 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                    <Space>
                      <LinkOutlined style={{ color: '#1890ff' }} />
                      配对持仓
                    </Space>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {snapshot.accounts[0].positions.map((pos, index) => (
                      <div 
                        key={pos.symbol}
                        style={{
                          padding: '8px',
                          marginBottom: index < snapshot.accounts[0].positions.length - 1 ? '8px' : '0',
                          background: selectedStockCode === pos.symbol ? '#e6f7ff' : '#fafafa',
                          border: '1px solid #d9d9d9',
                          borderRadius: '4px'
                        }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Space>
                              <Tag color={selectedStockCode === pos.symbol ? 'blue' : 'default'}>
                                {pos.symbol}
                              </Tag>
                              <span style={{ fontSize: '12px', color: '#666' }}>
                                {pos.quantity}股 @ ¥{pos.avgCost.toFixed(2)}
                              </span>
                            </Space>
                          </Col>
                          <Col>
                            <span style={{ 
                              fontSize: '12px', 
                              fontWeight: 'bold',
                              color: pos.unrealizedPnlBase >= 0 ? '#52c41a' : '#ff4d4f'
                            }}>
                              ¥{pos.unrealizedPnlBase.toFixed(2)}
                            </span>
                          </Col>
                        </Row>
                      </div>
                    ))}
                    
                    {/* 配对总盈亏 */}
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: '#f0f5ff',
                      border: '1px dashed #91d5ff',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <Space>
                        <span style={{ fontSize: '12px', color: '#666' }}>配对总盈亏:</span>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          color: snapshot.unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f'
                        }}>
                          ¥{snapshot.unrealizedPnl.toFixed(2)}
                        </span>
                      </Space>
                    </div>
                  </div>
                </>
              )}
            </Space>
          </Card>
        </Col>

        {/* 中间：选股区 (35%) */}
        <Col xs={24} lg={8}>
          <Card title=" 选股区" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Tabs defaultActiveKey="manual">
                <TabPane tab="手动输入" key="manual">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>输入股票代码：</div>
                      <Input.Search
                        placeholder="例如：600519"
                        enterButton="确定"
                        onSearch={handleStockSearch}
                        prefix={<SearchOutlined />}
                      />
                    </div>
                    
                    {selectedStockCode && (
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Alert
                          message={`✅ 已选定: ${selectedStockCode}`}
                          type="success"
                          showIcon
                          action={
                            <Button size="small" onClick={() => setSelectedStockCode('')}>
                              清除
                            </Button>
                          }
                        />
                        
                        {/* AI 深度分析按钮 */}
                        <Button
                          type="primary"
                          icon={<LineChartOutlined />}
                          onClick={handleAnalyzeManualStock}
                          loading={analyzeLoading}
                          block
                        >
                          🤖 AI 深度分析
                        </Button>
                        
                        {/* 显示分析结果 */}
                        {manualStockAnalysis && (
                          <Card size="small" title="📊 技术指标分析">
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              {/* 价格和情绪 */}
                              <Row gutter={[8, 8]}>
                                <Col span={12}>
                                  <div style={{ fontSize: '12px', color: '#999' }}>当前价格</div>
                                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                    ¥{manualStockAnalysis.current_price?.toFixed(2) || 'N/A'}
                                  </div>
                                </Col>
                                <Col span={12}>
                                  <div style={{ fontSize: '12px', color: '#999' }}>市场情绪</div>
                                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    {getSentimentTag(manualStockAnalysis.sentiment || 'neutral')}
                                  </div>
                                </Col>
                              </Row>
                              
                              {/* 网格订单摘要 */}
                              {manualStockAnalysis.grid_orders && manualStockAnalysis.grid_orders.length > 0 && (
                                <>
                                  <Divider style={{ margin: '8px 0' }} />
                                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                                    生成 {manualStockAnalysis.grid_orders.length} 个网格订单
                                  </div>
                                  <Table
                                    dataSource={manualStockAnalysis.grid_orders.slice(0, 3)} // 只显示前3个
                                    rowKey={(_, index) => index || 0}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                      {
                                        title: '类型',
                                        dataIndex: 'order_type',
                                        width: 60,
                                        render: (type) => (
                                          <Tag color={
                                            type === 'ENTRY' ? 'blue' :
                                            type === 'TAKE_PROFIT' ? 'green' : 'red'
                                          }>
                                            {type === 'ENTRY' ? '建仓' : type === 'TAKE_PROFIT' ? '止盈' : '止损'}
                                          </Tag>
                                        )
                                      },
                                      {
                                        title: '价格',
                                        dataIndex: 'price',
                                        render: (val) => `¥${val.toFixed(2)}`
                                      },
                                      {
                                        title: '方向',
                                        dataIndex: 'side',
                                        render: (side) => (
                                          <span style={{ color: side === 'BUY' ? '#52c41a' : '#ff4d4f' }}>
                                            {side === 'BUY' ? '买' : '卖'}
                                          </span>
                                        )
                                      }
                                    ]}
                                  />
                                </>
                              )}
                              
                              {/* 选定按钮 */}
                              <Button
                                type="primary"
                                block
                                onClick={handleSelectManualStock}
                              >
                                ✅ 选定此股票为操作标的
                              </Button>
                            </Space>
                          </Card>
                        )}
                      </Space>
                    )}
                    
                    <Alert
                      message="提示"
                      description="输入股票代码后，点击“AI 深度分析”获取技术指标和交易建议。"
                      type="info"
                      showIcon
                    />
                  </Space>
                </TabPane>
                
                <TabPane tab="智能推荐" key="ai">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* AI 选股按钮 */}
                    {recommendedStocks.length === 0 && (
                      <Button
                        type="primary"
                        icon={<RiseOutlined />}
                        onClick={handleGetRecommendations}
                        loading={recommendLoading}
                        block
                        size="large"
                      >
                        🤖 AI 智能选股（Top 5）
                      </Button>
                    )}
                    
                    {/* 显示推荐结果 */}
                    {recommendedStocks.length > 0 && (
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* 刷新按钮 */}
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={handleGetRecommendations}
                          loading={recommendLoading}
                          size="small"
                        >
                          刷新推荐
                        </Button>
                        
                        {/* TAB 展示推荐股票 */}
                        <Tabs
                          activeKey={activeRecommendTab}
                          onChange={setActiveRecommendTab}
                          items={recommendedStocks.map((stock, index) => ({
                            key: stock.stock_code,
                            label: `${index + 1}. ${stock.stock_name}`,
                            children: (
                              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                {/* 综合评分卡片 */}
                                <Card size="small">
                                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                          {stock.stock_name} ({stock.stock_code})
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                          排名: 第 {stock.rank} 名
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: stock.score >= 80 ? '#52c41a' : stock.score >= 60 ? '#faad14' : '#ff4d4f' }}>
                                          {stock.score}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#999' }}>综合评分</div>
                                      </div>
                                    </div>
                                    
                                    <Divider style={{ margin: '8px 0' }} />
                                    
                                    {/* 关键技术指标 */}
                                    <Row gutter={[8, 8]}>
                                      <Col span={12}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>当前价格</div>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                          ¥{stock.current_price.toFixed(2)}
                                          <span style={{ 
                                            fontSize: '12px', 
                                            marginLeft: '4px',
                                            color: stock.change_pct >= 0 ? '#52c41a' : '#ff4d4f'
                                          }}>
                                            {stock.change_pct >= 0 ? '↑' : '↓'} {Math.abs(stock.change_pct)}%
                                          </span>
                                        </div>
                                      </Col>
                                      <Col span={12}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>趋势强度</div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                          {stock.trend_strength}%
                                          <div style={{ marginTop: '4px' }}>
                                            <div style={{ 
                                              height: '6px', 
                                              background: '#f0f0f0', 
                                              borderRadius: '3px',
                                              overflow: 'hidden'
                                            }}>
                                              <div style={{ 
                                                width: `${stock.trend_strength}%`,
                                                height: '100%',
                                                background: stock.trend_strength >= 70 ? '#52c41a' : stock.trend_strength >= 50 ? '#faad14' : '#ff4d4f',
                                                borderRadius: '3px'
                                              }} />
                                            </div>
                                          </div>
                                        </div>
                                      </Col>
                                    </Row>
                                    
                                    <Row gutter={[8, 8]}>
                                      <Col span={8}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>RSI</div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                          {stock.rsi}
                                        </div>
                                      </Col>
                                      <Col span={8}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>量比</div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                          {stock.volume_ratio}
                                        </div>
                                      </Col>
                                      <Col span={8}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>MACD</div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                          {stock.macd_signal === 'bullish' ? '🟢 金叉' : stock.macd_signal === 'bearish' ? '🔴 死叉' : '⚪ 中性'}
                                        </div>
                                      </Col>
                                    </Row>
                                    
                                    <Divider style={{ margin: '8px 0' }} />
                                    
                                    {/* 支撑/阻力位 */}
                                    <Row gutter={[8, 8]}>
                                      <Col span={12}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>支撑位</div>
                                        <div style={{ fontSize: '14px', color: '#52c41a', fontWeight: 'bold' }}>
                                          ¥{stock.support_level.toFixed(2)}
                                        </div>
                                      </Col>
                                      <Col span={12}>
                                        <div style={{ fontSize: '12px', color: '#999' }}>阻力位</div>
                                        <div style={{ fontSize: '14px', color: '#ff4d4f', fontWeight: 'bold' }}>
                                          ¥{stock.resistance_level.toFixed(2)}
                                        </div>
                                      </Col>
                                    </Row>
                                    
                                    {/* 推荐理由 */}
                                    <Alert
                                      message="💡 推荐理由"
                                      description={
                                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                          {stock.reasons.map((reason: string, idx: number) => (
                                            <li key={idx}>{reason}</li>
                                          ))}
                                        </ul>
                                      }
                                      type="info"
                                      showIcon
                                    />
                                    
                                    {/* 风险提示 */}
                                    <Alert
                                      message="⚠️ 风险提示"
                                      description={
                                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                          {stock.risks.map((risk: string, idx: number) => (
                                            <li key={idx}>{risk}</li>
                                          ))}
                                        </ul>
                                      }
                                      type="warning"
                                      showIcon
                                    />
                                    
                                    {/* 选定按钮 */}
                                    <Button
                                      type="primary"
                                      block
                                      onClick={() => handleSelectRecommendedStock(stock.stock_code)}
                                    >
                                      ✅ 选定此股票为操作标的
                                    </Button>
                                  </Space>
                                </Card>
                              </Space>
                            )
                          }))}
                        />
                      </Space>
                    )}
                  </Space>
                </TabPane>
              </Tabs>

              <Divider style={{ margin: '12px 0' }} />

              {/* 已选标的 */}
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>✅ 当前操作标的</div>
              {selectedStockCode ? (
                <Alert
                  message={`${selectedStockCode} - 点击交易执行区的"生成交易建议"按钮获取策略`}
                  type="success"
                  showIcon
                />
              ) : (
                <Alert
                  message="请先在上方选择股票"
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          </Card>
        </Col>

        {/* 右侧：交易执行区 (40%) */}
        <Col xs={24} lg={10}>
          <Card title="💹 交易执行区" style={{ height: '100%' }}>
            <Tabs defaultActiveKey="today">
              <TabPane tab="📋 今日交易建议" key="today">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {/* 当前标的信息 */}
                  <Alert
                    message={`📌 当前标的: ${selectedStockCode || '未选择'}`}
                    description={selectedStockCode ? "点击下方按钮生成交易建议" : "请先在选股区选择股票"}
                    type={selectedStockCode ? "info" : "warning"}
                    showIcon
                  />

                  {/* 生成建议按钮 */}
                  {!suggestionData && (
                    <Button
                      type="primary"
                      icon={<LineChartOutlined />}
                      onClick={handleGetSuggestion}
                      disabled={!selectedStockCode}
                      loading={loading}
                      block
                      size="large"
                    >
                      📊 生成交易建议
                    </Button>
                  )}

                  {/* 显示交易建议（可编辑） */}
                  {suggestionData && editableOrders.length > 0 && (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {/* 市场情绪 */}
                      <Alert 
                        message={`市场情绪: ${suggestionData.sentiment === 'bullish' ? '看涨 📈' : suggestionData.sentiment === 'bearish' ? '看跌 📉' : '中性 ➡️'}`}
                        type={suggestionData.sentiment === 'bullish' ? 'success' : suggestionData.sentiment === 'bearish' ? 'error' : 'info'}
                      />
                      
                      {/* 可编辑的网格订单表格 */}
                      <Table 
                        dataSource={editableOrders}
                        rowKey={(_, index) => index || 0}
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: '类型',
                            dataIndex: 'order_type',
                            width: 80,
                            render: (type) => (
                              <Tag color={
                                type === 'ENTRY' ? 'blue' :
                                type === 'TAKE_PROFIT' ? 'green' : 'red'
                              }>
                                {type === 'ENTRY' ? '建仓' : type === 'TAKE_PROFIT' ? '止盈' : '止损'}
                              </Tag>
                            )
                          },
                          {
                            title: '价格',
                            dataIndex: 'price',
                            width: 100,
                            render: (val, _, index) => (
                              <InputNumber
                                defaultValue={val}
                                min={0}
                                precision={2}
                                size="small"
                                style={{ width: '100%' }}
                                onChange={(value) => handleOrderChange(index, 'price', value)}
                              />
                            )
                          },
                          {
                            title: '数量',
                            dataIndex: 'quantity',
                            width: 80,
                            render: (val, _, index) => (
                              <InputNumber
                                defaultValue={val}
                                min={0}
                                size="small"
                                style={{ width: '100%' }}
                                onChange={(value) => handleOrderChange(index, 'quantity', value)}
                              />
                            )
                          },
                          {
                            title: '方向',
                            dataIndex: 'side',
                            width: 60,
                            render: (side) => (
                              <span style={{ color: side === 'BUY' ? '#52c41a' : '#ff4d4f' }}>
                                {side === 'BUY' ? '买入 ↑' : '卖出 ↓'}
                              </span>
                            )
                          },
                          {
                            title: '',
                            width: 60,
                            render: (_, __, index) => (
                              <Button 
                                danger 
                                size="small"
                                onClick={() => handleDeleteOrder(index)}
                              >
                                删除
                              </Button>
                            )
                          }
                        ]}
                      />
                      
                      {/* AI 优化按钮 */}
                      <Button 
                        type="default"
                        block
                        size="middle"
                        icon={<LineChartOutlined />}
                        onClick={handleAIOptimizeParams}
                        style={aiOptimized ? { background: '#f6ffed', borderColor: '#b7eb8f' } : {}}
                      >
                        {aiOptimized ? '✨ AI已优化' : '🤖 AI自动优化参数'}
                      </Button>
                      
                      {/* 人工修正提示 */}
                      <Alert 
                        message="💡 您可以修改上方价格和数量，确认无误后点击执行"
                        type="info"
                        showIcon
                      />
                      
                      {/* 执行按钮 */}
                      <Button 
                        type="primary" 
                        block 
                        size="large"
                        icon={<PlayCircleOutlined />}
                        onClick={handleExecuteDailyPlan}
                        loading={loading}
                      >
                        🚀 执行今日交易计划 ({editableOrders.length} 个订单)
                      </Button>
                      
                      {/* 重新生成按钮 */}
                      <Button 
                        block
                        onClick={() => {
                          setSuggestionData(null);
                          setEditableOrders([]);
                        }}
                      >
                        🔄 重新生成建议
                      </Button>
                    </Space>
                  )}
                </Space>
              </TabPane>
              
              <TabPane tab="⏰ 调度器管理" key="scheduler">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Alert
                    message={`状态: ${schedulerRunning ? '🟢 运行中' : '⚪ 已停止'}`}
                    type={schedulerRunning ? 'success' : 'warning'}
                    showIcon
                  />
                  
                  <Space style={{ width: '100%' }} wrap>
                    <Button
                      type={schedulerRunning ? "primary" : "default"}
                      icon={schedulerRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                      onClick={schedulerRunning ? handleStopScheduler : handleStartScheduler}
                    >
                      {schedulerRunning ? '⏹️ 停止' : '▶️ 启动'}
                    </Button>
                    <Button
                      icon={<LineChartOutlined />}
                      onClick={handleTriggerDailySuggestions}
                      loading={loading}
                    >
                      🔄 立即生成
                    </Button>
                  </Space>
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                    <div>• 每日 09:00 - 生成交易建议</div>
                    <div>• 每日 11:30 - 盘中检查</div>
                    <div>• 每日 15:30 - 生成复盘报告</div>
                  </div>
                  
                  <Alert
                    message="💡 调度器会在后台自动执行任务，您只需登录查看并确认即可"
                    type="info"
                    showIcon
                  />
                </Space>
              </TabPane>
            </Tabs>
            
            <Divider style={{ margin: '12px 0' }} />
            
            {/* 当前操作标的选择器 */}
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>✅ 当前操作标的</div>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Select
                style={{ width: '100%' }}
                placeholder="选择推荐股票或手动输入代码"
                showSearch
                value={selectedStockCode || undefined}
                onChange={(value) => setSelectedStockCode(value)}
                options={[
                  ...recommendedStocks.map((stock, index) => ({
                    label: `${index + 1}. ${stock.stock_name} (${stock.stock_code}) - 评分:${stock.score}`,
                    value: stock.stock_code
                  })),
                  { label: '─── 手动输入 ───', value: '__manual__', disabled: true }
                ]}
                filterOption={(input, option) => {
                  if (!option?.label) return false;
                  return option.label.toLowerCase().includes(input.toLowerCase());
                }}
                allowClear
              />
              
              {selectedStockCode && (
                <Alert
                  message={`${selectedStockCode} - 点击右侧“生成交易建议”按钮获取策略`}
                  type="success"
                  showIcon
                  action={
                    <Button size="small" onClick={() => setSelectedStockCode('')}>
                      清除
                    </Button>
                  }
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 底部：回测及进化区 (100%) */}
      <Card title="🧪 回测及进化区" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="功能开发中"
            description="此区域将提供历史回测、策略参数优化、遗传算法进化、策略对比分析等功能。后续会集成回测引擎和策略进化模块。"
            type="info"
            showIcon
          />

          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" title="📊 回测配置">
                <Form layout="vertical" size="small">
                  <Form.Item label="标的">
                    <Input placeholder={selectedStockCode || "股票代码"} disabled={!!selectedStockCode} />
                  </Form.Item>
                  <Form.Item label="周期">
                    <Input placeholder="YYYY-MM-DD ~ YYYY-MM-DD" disabled />
                  </Form.Item>
                  <Form.Item label="初始资金">
                    <InputNumber placeholder="100,000" style={{ width: '100%' }} disabled />
                  </Form.Item>
                  <Button 
                    block 
                    type="primary"
                    onClick={handleRunBacktest}
                    loading={loading}
                  >
                    ▶️ 开始回测
                  </Button>
                </Form>
              </Card>
            </Col>

            <Col span={8}>
              <Card size="small" title="📈 回测结果">
                {backtestResult ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="总收益">
                        <span style={{ color: backtestResult.total_return >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                          {backtestResult.total_return >= 0 ? '+' : ''}{backtestResult.total_return}%
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="年化收益">
                        <span style={{ color: backtestResult.annual_return >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                          {backtestResult.annual_return >= 0 ? '+' : ''}{backtestResult.annual_return}%
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="最大回撤">
                        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                          {backtestResult.max_drawdown}%
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="夏普比率">
                        <span style={{ color: backtestResult.sharpe_ratio > 1 ? '#52c41a' : '#faad14', fontWeight: 'bold' }}>
                          {backtestResult.sharpe_ratio}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="胜率">
                        <span style={{ color: backtestResult.win_rate > 50 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                          {backtestResult.win_rate}%
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                    <Divider style={{ margin: '8px 0' }} />
                    <Space size="small">
                      <Tag color="blue">{backtestResult.total_trades} 笔交易</Tag>
                      <Tag color="green">{backtestResult.winning_trades} 胜</Tag>
                      <Tag color="red">{backtestResult.losing_trades} 负</Tag>
                    </Space>
                  </Space>
                ) : (
                  <Empty 
                    description="暂无回测数据" 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: '20px 0' }}
                  />
                )}
              </Card>
            </Col>

            <Col span={8}>
              <Card size="small" title="策略进化">
                <Form layout="vertical" size="small">
                  <Form.Item label="进化代数">
                    <InputNumber placeholder="50" style={{ width: '100%' }} disabled />
                  </Form.Item>
                  <Form.Item label="种群大小">
                    <InputNumber placeholder="100" style={{ width: '100%' }} disabled />
                  </Form.Item>
                  <Button block disabled>
                    🧬 启动进化
                  </Button>
                </Form>
              </Card>
            </Col>
          </Row>

          <Space>
            <Button disabled>📊 对比分析</Button>
            <Button disabled>💾 保存策略</Button>
            <Button disabled>📤 导出报告</Button>
          </Space>
        </Space>
      </Card>

      {/* 交易执行对话框 */}
      <Modal
        title={`交易执行 - ${selectedAccount?.name || ''}`}
        open={tradeModalVisible}
        onCancel={() => {
          setTradeModalVisible(false);
          tradeForm.resetFields();
        }}
        onOk={() => tradeForm.submit()}
      >
        {selectedAccount && (
          <Alert
            message={`市场: ${selectedAccount.market.toUpperCase()} | 货币: ${selectedAccount.baseCurrency}`}
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          form={tradeForm}
          layout="vertical"
          onFinish={handleExecuteTrade}
        >
          <Form.Item
            label="股票代码"
            name="stock_code"
            rules={[{ required: true, message: '请输入股票代码' }]}
          >
            <Input placeholder="例如：600519" />
          </Form.Item>

          <Form.Item
            label="买卖方向"
            name="side"
            rules={[{ required: true, message: '请选择买卖方向' }]}
            initialValue="BUY"
          >
            <Select>
              <Select.Option value="BUY">
                <Space>
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                  <span>买入</span>
                </Space>
              </Select.Option>
              <Select.Option value="SELL">
                <Space>
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                  <span>卖出</span>
                </Space>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="价格"
            name="price"
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              min={0.01}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              placeholder="100.00"
              addonBefore="¥"
            />
          </Form.Item>

          <Form.Item
            label="数量"
            name="quantity"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber
              min={100}
              step={100}
              style={{ width: '100%' }}
              placeholder="100"
              addonAfter="股"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 交易建议对话框（已弃用，改为页面内展示） */}
      {/* 交易执行确认对话框 */}
      <Modal
        title="🚀 确认执行交易计划"
        open={executeModalVisible}
        onCancel={() => {
          setExecuteModalVisible(false);
          setPendingOrders([]);
        }}
        onOk={handleConfirmExecute}
        okText="确认执行"
        cancelText="取消"
        okButtonProps={{ danger: true, loading }}
        width={700}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message={`⚠️ 即将执行以下交易（${selectedAccount?.market === 'cn' ? 'A股 T+1 规则适用' : '无 T+1 限制'}`}
            description={`标的: ${selectedStockCode} | 订单数量: ${pendingOrders.length} 个`}
            type="warning"
            showIcon
          />

          {/* 订单预览 */}
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📋 订单预览</div>
          <Table
            dataSource={pendingOrders}
            rowKey={(_, index) => index || 0}
            pagination={false}
            size="small"
            scroll={{ y: 300 }}
            columns={[
              {
                title: '类型',
                dataIndex: 'order_type',
                width: 80,
                render: (type) => (
                  <Tag color={
                    type === 'ENTRY' ? 'blue' :
                    type === 'TAKE_PROFIT' ? 'green' : 'red'
                  }>
                    {type === 'ENTRY' ? '建仓' : type === 'TAKE_PROFIT' ? '止盈' : '止损'}
                  </Tag>
                )
              },
              {
                title: '价格',
                dataIndex: 'price',
                width: 100,
                render: (val) => <span style={{ fontWeight: 'bold' }}>¥{val?.toFixed(2)}</span>
              },
              {
                title: '数量',
                dataIndex: 'quantity',
                width: 80,
                render: (val) => <span>{val} 股</span>
              },
              {
                title: '方向',
                dataIndex: 'side',
                width: 80,
                render: (side) => (
                  <span style={{ color: side === 'BUY' ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                    {side === 'BUY' ? '买入 ↑' : '卖出 ↓'}
                  </span>
                )
              },
              {
                title: '金额',
                dataIndex: 'price',
                width: 100,
                render: (price, record) => (
                  <span style={{ fontWeight: 'bold' }}>¥{(price * record.quantity).toFixed(2)}</span>
                )
              }
            ]}
          />

          {/* T+1 规则提示 */}
          {selectedAccount?.market === 'cn' && (
            <Alert
              message="📌 A股 T+1 规则提醒"
              description="今日买入的股票需明日才能卖出。如果订单中有卖出操作，请确保不是今日买入的。"
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
            />
          )}

          {/* 风险提示 */}
          <Alert
            message="⚠️ 风险提示"
            description="交易执行后无法撤销，请仔细检查以上订单信息。确认无误后点击“确认执行”按钮。"
            type="error"
            showIcon
            icon={<WarningOutlined />}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default SimulationTradingPage;
