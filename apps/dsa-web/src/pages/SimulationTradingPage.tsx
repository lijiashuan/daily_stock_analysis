/**
 * 模拟交易页面
 * 
 * 提供交易执行、交易建议查看、持仓详情等功能
 * 账户管理功能已移至 /portfolio 页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Input, InputNumber, message, Space, Row, Col, Statistic, Divider, Select, Alert, Empty, Descriptions, Modal } from 'antd';
import { ReloadOutlined, TrademarkOutlined, ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, ClockCircleOutlined, PlayCircleOutlined, StopOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { portfolioApi } from '../api/portfolio';
import type { PortfolioAccountItem, PortfolioSnapshotResponse } from '../types/portfolio';

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

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="可用资金"
              value={snapshot?.totalCash || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总资产"
              value={snapshot?.totalEquity || 0}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="浮动盈亏"
              value={snapshot?.unrealizedPnl || 0}
              precision={2}
              prefix={snapshot && snapshot.unrealizedPnl >= 0 ? <RiseOutlined /> : <FallOutlined />}
              valueStyle={{ 
                color: snapshot && snapshot.unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="调度器"
              value={schedulerRunning ? '运行中' : '已停止'}
              valueStyle={{ color: schedulerRunning ? '#52c41a' : '#999' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 账户选择和持仓详情 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 左侧：账户选择 */}
        <Col span={8}>
          <Card title="账户选择">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
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

              <Divider />

              {/* 快捷操作按钮 */}
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button
                  type="primary"
                  icon={<TrademarkOutlined />}
                  onClick={handleOpenTrade}
                  disabled={!selectedAccount}
                  block
                >
                  执行交易
                </Button>
                <Button
                  icon={<LineChartOutlined />}
                  onClick={handleGetSuggestion}
                  disabled={!selectedAccount}
                  loading={loading}
                  block
                >
                  生成交易建议
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* 右侧：持仓详情 */}
        <Col span={16}>
          <Card title="持仓详情">
            {selectedAccount && snapshot ? (
              <>
                <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="账户名称">{selectedAccount.name}</Descriptions.Item>
                  <Descriptions.Item label="市场">{selectedAccount.market.toUpperCase()}</Descriptions.Item>
                  <Descriptions.Item label="基础货币">{selectedAccount.baseCurrency}</Descriptions.Item>
                  <Descriptions.Item label="可用资金">¥{snapshot.totalCash.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="总市值">¥{snapshot.totalMarketValue.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="总权益">¥{snapshot.totalEquity.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="实现盈亏">
                    <span style={{ color: snapshot.realizedPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      ¥{snapshot.realizedPnl.toLocaleString()}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="未实现盈亏">
                    <span style={{ color: snapshot.unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      ¥{snapshot.unrealizedPnl.toLocaleString()}
                    </span>
                  </Descriptions.Item>
                </Descriptions>

                <Divider>持仓列表</Divider>
                
                {snapshot.accounts.length > 0 && snapshot.accounts[0].positions.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {snapshot.accounts[0].positions.map((pos) => (
                      <Col span={8} key={pos.symbol}>
                        <Card size="small">
                          <Statistic
                            title={pos.symbol}
                            value={pos.quantity}
                            suffix="股"
                            valueStyle={{ color: '#1890ff' }}
                          />
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                            成本: ¥{pos.avgCost.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '12px', color: pos.unrealizedPnlBase >= 0 ? '#52c41a' : '#ff4d4f' }}>
                            盈亏: ¥{pos.unrealizedPnlBase.toFixed(2)}
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty 
                    description="暂无持仓" 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: '20px 0' }}
                  />
                )}
              </>
            ) : (
              <Empty 
                description="请选择账户查看持仓" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 调度器管理 */}
      <Card title="调度器管理">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 状态显示 */}
          <Alert
            message={`调度器状态: ${schedulerRunning ? '运行中' : '已停止'}`}
            type={schedulerRunning ? 'success' : 'warning'}
            showIcon
          />
          
          {/* 按钮组 */}
          <Space>
            <Button
              type={schedulerRunning ? "default" : "primary"}
              icon={schedulerRunning ? <StopOutlined /> : <PlayCircleOutlined />}
              onClick={schedulerRunning ? handleStopScheduler : handleStartScheduler}
            >
              {schedulerRunning ? '停止调度器' : '启动调度器'}
            </Button>
            <Button
              icon={<LineChartOutlined />}
              onClick={handleTriggerDailySuggestions}
              loading={loading}
            >
              触发每日建议
            </Button>
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
