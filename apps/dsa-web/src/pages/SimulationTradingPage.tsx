/**
 * 模拟交易页面
 * 
 * 提供模拟账户管理、交易建议查看、交易执行等功能
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Form, Input, InputNumber, message, Tag, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, TradeMarkOutlined } from '@ant-design/icons';
import { simulationApi, Account, CreateAccountRequest } from '../api/simulation';

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
            <Input.Group compact>
              <Button style={{ width: '33%' }}>保守</Button>
              <Button type="primary" style={{ width: '34%' }}>平衡</Button>
              <Button style={{ width: '33%' }}>激进</Button>
            </Input.Group>
          </Form.Item>

          <Form.Item
            label="策略类型"
            name="strategy_type"
            initialValue="grid_trading"
          >
            <Input disabled value="网格交易（默认）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SimulationTradingPage;
