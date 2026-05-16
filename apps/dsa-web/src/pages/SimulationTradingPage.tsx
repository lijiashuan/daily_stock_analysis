/**
 * 模拟交易页面
 * 
 * 提供交易执行、交易建议查看、持仓详情等功能
 * 账户管理功能已移至 /portfolio 页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Input, InputNumber, message, Space, Row, Col, Statistic, Divider, Select, Alert, Empty, Descriptions, Modal } from 'antd';
import { ReloadOutlined, TrademarkOutlined, ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, ClockCircleOutlined, PlayCircleOutlined, StopOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { simulationApi, type Account, type TradingSuggestion } from '../api/simulation';

const SimulationTradingPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [suggestion, setSuggestion] = useState<TradingSuggestion | null>(null);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [tradeForm] = Form.useForm();

  // 加载账户列表
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await simulationApi.listAccounts();
      setAccounts(data);
      // 如果当前没有选中账户，自动选中第一个
      if (!selectedAccountId && data.length > 0) {
        setSelectedAccountId(data[0].account_id);
        setSelectedAccount(data[0]);
      }
    } catch (error) {
      message.error('加载账户失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // 账户选择变化
  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find(a => a.account_id === accountId);
    setSelectedAccount(account || null);
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
      const result = await simulationApi.executeTrade(selectedAccount.account_id, {
        stock_code: values.stock_code,
        side: values.side,
        price: values.price,
        quantity: values.quantity
      });
      
      if (result.success) {
        message.success(`交易成功: ${result.message}`);
        setTradeModalVisible(false);
        tradeForm.resetFields();
        // 重新加载账户信息
        const updatedAccounts = await simulationApi.listAccounts();
        setAccounts(updatedAccounts);
        const updatedAccount = updatedAccounts.find(a => a.account_id === selectedAccount.account_id);
        if (updatedAccount) {
          setSelectedAccount(updatedAccount);
        }
      } else {
        message.error(`交易失败: ${result.message}`);
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || '交易执行失败';
      message.error(errorMsg);
      console.error('Trade error:', error);
    }
  };

  // 获取交易建议
  const handleGetSuggestion = async () => {
    if (!selectedAccount) {
      message.warning('请先选择账户');
      return;
    }

    setLoading(true);
    try {
      const data = await simulationApi.generateSuggestion('TEST001', true);
      setSuggestion(data);
      setSuggestionModalVisible(true);
    } catch (error) {
      message.error('获取交易建议失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 启动调度器
  const handleStartScheduler = async () => {
    try {
      await simulationApi.startScheduler();
      message.success('调度器已启动');
      setSchedulerRunning(true);
    } catch (error) {
      message.error('启动调度器失败');
      console.error(error);
    }
  };

  // 停止调度器
  const handleStopScheduler = async () => {
    try {
      await simulationApi.stopScheduler();
      message.success('调度器已停止');
      setSchedulerRunning(false);
    } catch (error) {
      message.error('停止调度器失败');
      console.error(error);
    }
  };

  // 手动触发每日建议
  const handleTriggerDailySuggestions = async () => {
    try {
      await simulationApi.triggerDailySuggestions();
      message.success('交易建议生成任务已执行');
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
              value={selectedAccount?.available_cash || 0}
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
              value={selectedAccount?.total_assets || 0}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="浮动盈亏"
              value={selectedAccount?.profit_loss || 0}
              precision={2}
              prefix={selectedAccount && selectedAccount.profit_loss >= 0 ? <RiseOutlined /> : <FallOutlined />}
              valueStyle={{ 
                color: selectedAccount && selectedAccount.profit_loss >= 0 ? '#52c41a' : '#ff4d4f' 
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
                    label: `${acc.account_name} (¥${acc.available_cash.toLocaleString()})`,
                    value: acc.account_id
                  }))}
                />
              </div>

              <Alert
                message="提示"
                description="账户管理功能已移至 /portfolio 页面，您可以在那里创建、删除账户和管理资金。"
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
            {selectedAccount ? (
              <>
                <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="账户名称">{selectedAccount.account_name}</Descriptions.Item>
                  <Descriptions.Item label="初始资金">¥{selectedAccount.initial_capital.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="可用资金">¥{selectedAccount.available_cash.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="总资产">¥{selectedAccount.total_assets.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="浮动盈亏">
                    <span style={{ color: selectedAccount.profit_loss >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      ¥{selectedAccount.profit_loss.toLocaleString()} ({selectedAccount.profit_loss_pct.toFixed(2)}%)
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="交易次数">{selectedAccount.trade_count}</Descriptions.Item>
                </Descriptions>

                <Divider>持仓列表</Divider>
                
                {Object.entries(selectedAccount.positions).length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {Object.entries(selectedAccount.positions).map(([code, qty]) => (
                      <Col span={8} key={code}>
                        <Card size="small">
                          <Statistic
                            title={code}
                            value={qty}
                            suffix="股"
                            valueStyle={{ color: '#1890ff' }}
                          />
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
