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
  const [suggestion, setSuggestion] = useState<TradingSuggestion | null>(null);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [tradeForm] = Form.useForm();

  // 加载模拟账户列表
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await portfolioApi.getAccounts(false);
      // TODO: 后端需要支持按 account_type 过滤，目前先返回所有账户
      // 前端暂时通过名称区分（约定：包含"模拟"或"Sim"的账户为模拟账户）
      const simulationAccounts = data.accounts.filter(acc => 
        acc.name.includes('模拟') || acc.name.includes('Sim') || acc.name.includes('sim')
      );
      setAccounts(simulationAccounts);
      // 如果当前没有选中账户，自动选中第一个
      if (!selectedAccountId && simulationAccounts.length > 0) {
        setSelectedAccountId(simulationAccounts[0].id);
        setSelectedAccount(simulationAccounts[0]);
        // 加载该账户的快照
        await loadSnapshot(simulationAccounts[0].id);
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

  useEffect(() => {
    loadAccounts();
  }, []);

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

  // 打开交易对话框
  const handleOpenTrade = () => {
    if (!selectedAccount) {
      message.warning('请先选择账户');
      return;
    }
    setTradeModalVisible(true);
    tradeForm.resetFields();
  };

  // 执行交易
  const handleExecuteTrade = async (values: any) => {
    if (!selectedAccount) return;

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
      
      message.success(`交易成功: ID=${result.id}`);
      setTradeModalVisible(false);
      tradeForm.resetFields();
      // 重新加载账户快照
      await loadSnapshot(selectedAccount.id);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || '交易执行失败';
      message.error(errorMsg);
      console.error('Trade error:', error);
    }
  };

  // 获取交易建议（暂时保留 simulation API）
  const handleGetSuggestion = async () => {
    if (!selectedAccount) {
      message.warning('请先选择账户');
      return;
    }

    setLoading(true);
    try {
      // TODO: 需要实现基于 Portfolio 的交易建议生成
      message.info('交易建议功能开发中...');
      // const data = await simulationApi.generateSuggestion('TEST001', true);
      // setSuggestion(data);
      // setSuggestionModalVisible(true);
    } catch (error) {
      message.error('获取交易建议失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 启动调度器（暂时保留 simulation API）
  const handleStartScheduler = async () => {
    try {
      // TODO: 需要实现基于 Portfolio 的调度器
      message.info('调度器功能开发中...');
      // await simulationApi.startScheduler();
      // message.success('调度器已启动');
      // setSchedulerRunning(true);
    } catch (error) {
      message.error('启动调度器失败');
      console.error(error);
    }
  };

  // 停止调度器
  const handleStopScheduler = async () => {
    try {
      message.info('调度器功能开发中...');
      // await simulationApi.stopScheduler();
      // message.success('调度器已停止');
      // setSchedulerRunning(false);
    } catch (error) {
      message.error('停止调度器失败');
      console.error(error);
    }
  };

  // 手动触发每日建议
  const handleTriggerDailySuggestions = async () => {
    try {
      message.info('每日建议功能开发中...');
      // await simulationApi.triggerDailySuggestions();
      // message.success('交易建议生成任务已执行');
    } catch (error) {
      message.error('执行失败');
      console.error(error);
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
                description="请在 /portfolio 页面创建模拟账户（名称包含'模拟'或'Sim'），系统将自动识别为模拟账户。"
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
            onClick={loadAccounts}
            loading={loading}
          >
            刷新账户
          </Button>
        </Space>
      </Card>

      {/* 交易执行对话框 */}
      <Modal
        title={`交易执行 - ${selectedAccount?.account_name || ''}`}
        open={tradeModalVisible}
        onCancel={() => {
          setTradeModalVisible(false);
          tradeForm.resetFields();
        }}
        onOk={() => tradeForm.submit()}
      >
        {selectedAccount && (
          <Alert
            message={`可用资金: ¥${selectedAccount.available_cash.toLocaleString()}`}
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
        onCancel={() => setSuggestionModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSuggestionModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {suggestion && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="当前价格"
                    value={suggestion.current_price}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="预测范围"
                    value={`${suggestion.predicted_range[0].toFixed(2)} - ${suggestion.predicted_range[1].toFixed(2)}`}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="市场情绪"
                    value={suggestion.sentiment === 'bullish' ? '看涨' : suggestion.sentiment === 'bearish' ? '看跌' : '中性'}
                    valueStyle={{ 
                      color: suggestion.sentiment === 'bullish' ? '#52c41a' : suggestion.sentiment === 'bearish' ? '#ff4d4f' : '#faad14'
                    }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider>网格订单 ({suggestion.grid_orders.length}个)</Divider>
            
            {suggestion.grid_orders.length > 0 ? (
              <Alert message="网格订单功能开发中..." type="info" showIcon />
            ) : (
              <Alert message="暂无网格订单" type="info" showIcon />
            )}

            <Divider />
            <Alert
              message="建议说明"
              description={suggestion.suggestion}
              type="info"
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SimulationTradingPage;
