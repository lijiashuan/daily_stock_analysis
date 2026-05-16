/**
 * 模拟交易页面
 * 
 * 提供模拟账户管理、交易建议查看、交易执行等功能
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Form, Input, InputNumber, message, Tag, Space, Tabs, Row, Col, Statistic, Divider, Select, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, TradeMarkOutlined, ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined } from '@ant-design/icons';
import { simulationApi, Account, CreateAccountRequest, TradingSuggestion, GridOrder } from '../api/simulation';

const SimulationTradingPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 加载账户列表
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await simulationApi.listAccounts();
      setAccounts(data);
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

  // 创建账户
  const handleCreateAccount = async (values: any) => {
    try {
      const requestData: CreateAccountRequest = {
        account_name: values.account_name,
        initial_capital: values.initial_capital,
        trading_mode: values.trading_mode || 'balanced',
        strategy_type: values.strategy_type || 'grid_trading'
      };

      await simulationApi.createAccount(requestData);
      message.success('账户创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadAccounts();
    } catch (error) {
      message.error('创建账户失败');
      console.error(error);
    }
  };

  // 删除账户
  const handleDeleteAccount = async (accountId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个账户吗？此操作不可恢复。',
      onOk: async () => {
        try {
          await simulationApi.deleteAccount(accountId);
          message.success('账户已删除');
          loadAccounts();
        } catch (error) {
          message.error('删除账户失败');
          console.error(error);
        }
      }
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '账户名称',
      dataIndex: 'account_name',
      key: 'account_name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '初始资金',
      dataIndex: 'initial_capital',
      key: 'initial_capital',
      render: (value: number) => `¥${value.toLocaleString()}`
    },
    {
      title: '可用资金',
      dataIndex: 'available_cash',
      key: 'available_cash',
      render: (value: number) => `¥${value.toLocaleString()}`
    },
    {
      title: '总资产',
      dataIndex: 'total_assets',
      key: 'total_assets',
      render: (value: number) => `¥${value.toLocaleString()}`
    },
    {
      title: '盈亏',
      key: 'profit',
      render: (_: any, record: Account) => (
        <span style={{ color: record.profit_loss >= 0 ? '#52c41a' : '#ff4d4f' }}>
          ¥{record.profit_loss.toLocaleString()} ({record.profit_loss_pct.toFixed(2)}%)
        </span>
      )
    },
    {
      title: '持仓',
      dataIndex: 'positions',
      key: 'positions',
      render: (positions: Record<string, number>) => (
        <Space wrap>
          {Object.entries(positions).map(([code, qty]) => (
            <Tag key={code} color="blue">
              {code}: {qty}股
            </Tag>
          ))}
          {Object.keys(positions).length === 0 && <span>-</span>}
        </Space>
      )
    },
    {
      title: '交易次数',
      dataIndex: 'trade_count',
      key: 'trade_count'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Account) => (
        <Space>
          <Button
            type="link"
            icon={<TradeMarkOutlined />}
            onClick={() => message.info(`交易功能开发中...`)}
          >
            交易
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAccount(record.account_id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <TradeMarkOutlined />
            <span>模拟交易系统</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建账户
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAccounts}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="account_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建账户对话框 */}
      <Modal
        title="创建模拟账户"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateAccount}
        >
          <Form.Item
            label="账户名称"
            name="account_name"
            rules={[{ required: true, message: '请输入账户名称' }]}
          >
            <Input placeholder="例如：我的模拟账户" />
          </Form.Item>

          <Form.Item
            label="初始资金"
            name="initial_capital"
            rules={[{ required: true, message: '请输入初始资金' }]}
          >
            <InputNumber
              min={1000}
              step={1000}
              style={{ width: '100%' }}
              placeholder="100000"
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/¥\s?|(,*)/g, '') as unknown as number}
            />
          </Form.Item>

          <Form.Item
            label="交易模式"
            name="trading_mode"
            initialValue="balanced"
          >
            <Select>
              <Select.Option value="conservative">保守型</Select.Option>
              <Select.Option value="balanced">平衡型</Select.Option>
              <Select.Option value="aggressive">激进型</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="策略类型"
            name="strategy_type"
            initialValue="grid_trading"
          >
            <Select>
              <Select.Option value="grid_trading">网格交易</Select.Option>
              <Select.Option value="intraday_swing">日内波段</Select.Option>
              <Select.Option value="paired_trade">配对交易</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

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

            <Divider orientation="left">网格订单 ({suggestion.grid_orders.length}个)</Divider>
            
            {suggestion.grid_orders.length > 0 ? (
              <Table
                dataSource={suggestion.grid_orders}
                rowKey={(record, index) => `${record.price}-${index}`}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '价格',
                    dataIndex: 'price',
                    key: 'price',
                    render: (value: number) => `¥${value.toFixed(2)}`
                  },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    key: 'quantity',
                    render: (value: number) => `${value}股`
                  },
                  {
                    title: '方向',
                    dataIndex: 'side',
                    key: 'side',
                    render: (value: string) => (
                      <Tag color={value === 'BUY' ? 'green' : 'red'}>
                        {value === 'BUY' ? '买入' : '卖出'}
                      </Tag>
                    )
                  },
                  {
                    title: '类型',
                    dataIndex: 'order_type',
                    key: 'order_type'
                  },
                  {
                    title: '说明',
                    dataIndex: 'notes',
                    key: 'notes'
                  }
                ]}
              />
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
