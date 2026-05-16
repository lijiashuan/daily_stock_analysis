/**
 * 模拟交易页面
 * 
 * 提供交易执行、交易建议查看、持仓详情等功能
 * 账户管理功能已移至 /portfolio 页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Input, InputNumber, message, Space, Row, Col, Statistic, Divider, Select, Alert, Empty, Descriptions, Modal, Tabs, Table, Tag } from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, PlayCircleOutlined, StopOutlined, RiseOutlined, FallOutlined, StarOutlined, SearchOutlined } from '@ant-design/icons';
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
    
    if (!selectedAccount) {
      message.warning('请先选择账户');
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
          stock_code: '600519',  // 可以改为让用户输入
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
      
      // 保存数据并显示对话框
      setSuggestionData(data);
      setSuggestionModalVisible(true);
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

  // 执行今日交易计划
  const handleExecuteDailyPlan = async () => {
    console.log('[handleExecuteDailyPlan] Executing daily plan...');
    try {
      const response = await fetch('/api/v1/simulation/scheduler/execute-daily-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: editableOrders
        })
      });
      
      console.log('[handleExecuteDailyPlan] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleExecuteDailyPlan] Error:', errorText);
        throw new Error(`执行交易计划失败: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[handleExecuteDailyPlan] Response:', data);
      message.success('今日交易计划已执行');
      
      // 重新加载账户快照
      await loadSnapshot(selectedAccount?.id || 0);
    } catch (error) {
      console.error('[handleExecuteDailyPlan] Error:', error);
      message.error(error instanceof Error ? error.message : '执行失败');
    }
  };

  // 修改订单
  const handleOrderChange = (index: number, field: string, value: any) => {
    const newOrders = [...editableOrders];
    newOrders[index][field] = value;
    setEditableOrders(newOrders);
  };

  // 删除订单
  const handleDeleteOrder = (index: number) => {
    const newOrders = editableOrders.filter((_, i) => i !== index);
    setEditableOrders(newOrders);
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
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.accounts[0].positions.map((pos) => (
                        <tr key={pos.symbol}>
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
            </Space>
          </Card>
        </Col>

        {/* 中间：选股区 (35%) */}
        <Col xs={24} lg={8}>
          <Card title="🎯 选股区" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Alert
                message="功能开发中"
                description="此区域将提供智能选股、股票筛选、深度分析等功能。后续会集成选股器 API，支持多维度评分和候选池管理。"
                type="info"
                showIcon
              />

              <Divider style={{ margin: '12px 0' }} />

              {/* 筛选条件（占位） */}
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>筛选条件</div>
              <Form layout="vertical" size="small">
                <Form.Item label="市场">
                  <Select placeholder="选择市场" disabled>
                    <Select.Option value="A">A股</Select.Option>
                    <Select.Option value="HK">港股</Select.Option>
                    <Select.Option value="US">美股</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label="评分范围">
                  <InputNumber placeholder="最低评分" style={{ width: '100%' }} disabled />
                </Form.Item>
                <Form.Item label="趋势类型">
                  <Select placeholder="选择趋势" disabled>
                    <Select.Option value="bullish">多头排列</Select.Option>
                    <Select.Option value="bearish">空头排列</Select.Option>
                  </Select>
                </Form.Item>
                <Button block disabled>
                  🔍 开始筛选
                </Button>
              </Form>

              <Divider style={{ margin: '12px 0' }} />

              {/* 候选股票列表（占位） */}
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>候选股票列表</div>
              <Empty 
                description="暂无候选股票" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '20px 0' }}
              />

              <Divider style={{ margin: '12px 0' }} />

              {/* 已选标的 */}
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>✅ 已选标的</div>
              {selectedAccount ? (
                <Alert
                  message="请先在上方选股区选择股票"
                  type="info"
                  showIcon
                />
              ) : (
                <Alert
                  message="请先选择账户"
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

      {/* 交易建议对话框 */}
      <Modal
        title="交易建议"
        open={suggestionModalVisible}
        onCancel={() => {
          setSuggestionModalVisible(false);
          setSuggestionData(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setSuggestionModalVisible(false);
            setSuggestionData(null);
          }}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {suggestionData ? (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="股票代码">{suggestionData.stock_code}</Descriptions.Item>
              <Descriptions.Item label="当前价格">¥{suggestionData.current_price?.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="市场情绪">
                <span style={{ 
                  color: suggestionData.sentiment === 'bullish' ? '#52c41a' : 
                         suggestionData.sentiment === 'bearish' ? '#ff4d4f' : '#999'
                }}>
                  {suggestionData.sentiment === 'bullish' ? '看涨' : 
                   suggestionData.sentiment === 'bearish' ? '看跌' : '中性'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="网格订单数">{suggestionData.grid_orders?.length || 0} 个</Descriptions.Item>
            </Descriptions>

            <Divider>网格订单详情</Divider>
            
            {suggestionData.grid_orders && suggestionData.grid_orders.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'left' }}>类型</th>
                      <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'right' }}>价格</th>
                      <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'right' }}>数量</th>
                      <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'left' }}>方向</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestionData.grid_orders.map((order: any, index: number) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>
                          <span style={{
                            color: order.order_type === 'ENTRY' ? '#1890ff' :
                                   order.order_type === 'TAKE_PROFIT' ? '#52c41a' : '#ff4d4f',
                            fontWeight: 'bold'
                          }}>
                            {order.order_type === 'ENTRY' ? '建仓' :
                             order.order_type === 'TAKE_PROFIT' ? '止盈' : '止损'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'right' }}>
                          ¥{order.price?.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'right' }}>
                          {order.quantity} 股
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>
                          <span style={{
                            color: order.side === 'BUY' ? '#52c41a' : '#ff4d4f'
                          }}>
                            {order.side === 'BUY' ? '买入 ↑' : '卖出 ↓'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty description="暂无网格订单" />
            )}

            {suggestionData.suggestion && (
              <>
                <Divider>交易建议</Divider>
                <Alert message={suggestionData.suggestion} type="info" showIcon />
              </>
            )}
          </div>
        ) : (
          <Empty description="暂无交易建议数据" />
        )}
      </Modal>
    </div>
  );
};

export default SimulationTradingPage;
