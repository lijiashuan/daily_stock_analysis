/**
 * 模拟交易页面
 * 
 * 提供交易执行、交易建议查看、持仓详情等功能
 * 账户管理功能已移至 /portfolio 页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Input, InputNumber, message, Space, Row, Col, Statistic, Divider, Select, Alert, Empty, Descriptions, Modal, Tabs, Table, Tag, Tooltip, Popconfirm } from 'antd';
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
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [suggestionData, setSuggestionData] = useState<any>(null);  // 存储交易建议数据
  const [schedulerRunning, setSchedulerRunning] = useState(false);  // 调度器运行状态
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');  // 当前选定的股票代码
  const [editableOrders, setEditableOrders] = useState<any[]>([]);  // 可编辑的订单列表
  const [tradeForm] = Form.useForm();
  const [executeModalVisible, setExecuteModalVisible] = useState(false);  // 执行确认对话框
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);  // 待执行的订单

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

  // 打开交易对话框
  const handleOpenTrade = () => {
    console.log('[handleOpenTrade] selectedAccount:', selectedAccount);
    console.log('[handleOpenTrade] selectedAccountId:', selectedAccountId);
    console.log('[handleOpenTrade] accounts:', accounts);
    
    if (!selectedAccount) {
      message.warning('请先选择账户');
      return;
    }
    console.log('[handleOpenTrade] Opening trade modal...');
    setTradeModalVisible(true);
    tradeForm.resetFields();
  };

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

  // 检查 T+1 规则（A股）
  const checkT1Rule = (order: any): { valid: boolean; message: string } => {
    if (!selectedAccount) return { valid: true, message: '' };
    
    // 只对 A股执行 T+1 检查
    if (selectedAccount.market !== 'A') {
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
      const today = new Date().toISOString().split('T')[0];
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
                    )}
                    
                    <Alert
                      message="提示"
                      description="直接输入股票代码，或切换到'智能推荐'查看AI分析的股票。"
                      type="info"
                      showIcon
                    />
                  </Space>
                </TabPane>
                
                <TabPane tab="智能推荐" key="ai">
                  <Alert
                    message="功能开发中"
                    description="此区域将提供智能选股、股票筛选、深度分析等功能。"
                    type="info"
                    showIcon
                  />
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>筛选条件</div>
                  <Form layout="vertical" size="small">
                    <Form.Item label="市场">
                      <Select placeholder="选择市场" disabled>
                        <Select.Option value="A">A股</Select.Option>
                        <Select.Option value="HK">港股</Select.Option>
                        <Select.Option value="US">美股</Select.Option>
                      </Select>
                    </Form.Item>
                    <Button block disabled>🔍 开始筛选</Button>
                  </Form>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>候选股票列表</div>
                  <Empty description="暂无候选股票" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
              <Card size="small" title="回测配置">
                <Form layout="vertical" size="small">
                  <Form.Item label="标的">
                    <Input placeholder="股票代码" disabled />
                  </Form.Item>
                  <Form.Item label="周期">
                    <Input placeholder="YYYY-MM-DD ~ YYYY-MM-DD" disabled />
                  </Form.Item>
                  <Form.Item label="初始资金">
                    <InputNumber placeholder="100,000" style={{ width: '100%' }} disabled />
                  </Form.Item>
                  <Button block disabled>
                    ▶️ 开始回测
                  </Button>
                </Form>
              </Card>
            </Col>

            <Col span={8}>
              <Card size="small" title="回测结果">
                <Empty 
                  description="暂无回测数据" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: '20px 0' }}
                />
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
            message={`⚠️ 即将执行以下交易（${selectedAccount?.market === 'A' ? 'A股 T+1 规则适用' : '无 T+1 限制'}）`}
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
          {selectedAccount?.market === 'A' && (
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
