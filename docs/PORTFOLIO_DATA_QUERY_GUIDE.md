# 持仓数据查询功能完善说明

## 问题诊断

### 原有问题
当你询问AI当前持仓情况时，系统返回的数据存在以下问题：

1. **价格数据滞后**：虽然快照日期是今天（`as_of: 2026-05-14`），但价格数据使用的是昨天的收盘价（`price_date: 2026-05-13`，`price_source: history_close`）

2. **持仓数量正确**：系统会通过回放所有交易记录来计算持仓数量，所以会反映你今天录入的交易

3. **缺乏今日交易明细**：原有的 `get_portfolio_snapshot` 工具不直接显示今天执行了哪些交易

### 根本原因
在 `portfolio_service.py` 的 `_resolve_position_price` 方法中（第1072行）：
```python
cutoff_date = as_of_date - timedelta(days=1)
close = self.repo.get_latest_close_with_date(symbol=symbol, as_of=cutoff_date)
```

这段代码故意使用 `as_of_date - 1` 来获取历史收盘价，避免使用盘中未结算的价格进行估值。这是设计上的选择，但对于用户来说可能造成困惑。

## 新增功能

为了解决这个问题，我添加了两个新的AI工具：

### 1. `get_current_positions` - 获取当前持仓信息

**功能特点：**
- ✅ 显示所有账户的当前持仓（包含今天录入的交易）
- ✅ 显示每个持仓的最新可用价格（可能是昨天收盘价或实时价格）
- ✅ 明确标注价格来源（`price_source`）和价格日期（`price_date`）
- ✅ 可选显示今天执行的所有交易明细
- ✅ 提供持仓汇总信息（总资产、市值、现金、盈亏等）

**使用示例：**
```python
# 获取所有账户的当前持仓
get_current_positions()

# 获取指定账户的持仓
get_current_positions(account_id=1)

# 不包含今天的交易明细
get_current_positions(include_today_trades=False)

# 使用平均成本法
get_current_positions(cost_method="avg")
```

**返回数据结构：**
```json
{
  "status": "ok",
  "as_of": "2026-05-14",
  "cost_method": "fifo",
  "snapshot_summary": {
    "total_equity": 100000.0,
    "total_market_value": 80000.0,
    "total_cash": 20000.0,
    "realized_pnl": 5000.0,
    "unrealized_pnl": 3000.0,
    "account_count": 1
  },
  "positions": [
    {
      "symbol": "SH600519",
      "quantity": 6300,
      "avg_cost": 25.50,
      "last_price": 26.87,
      "price_source": "history_close",
      "price_date": "2026-05-13",
      "price_stale": false,
      "market_value_base": 169281.0,
      "unrealized_pnl_base": 8631.0,
      "account_id": 1,
      "account_name": "主账户"
    }
  ],
  "today_trades": [
    {
      "id": 123,
      "trade_date": "2026-05-14",
      "symbol": "SH600519",
      "side": "buy",
      "quantity": 2000,
      "price": 26.87,
      "fee": 10.0,
      "tax": 0.0
    }
  ],
  "note": "Positions reflect all trades recorded up to today..."
}
```

### 2. `get_account_recent_trades` - 获取近期交易记录

**功能特点：**
- ✅ 查询指定天数内的所有交易记录
- ✅ 可按股票代码过滤
- ✅ 显示完整的交易信息（价格、数量、手续费、税费等）
- ✅ 适合复盘今日或近期的操作

**使用示例：**
```python
# 获取最近7天的所有交易
get_account_recent_trades()

# 获取最近30天的交易
get_account_recent_trades(days=30)

# 获取某只股票的近期交易
get_account_recent_trades(symbol="600519")

# 获取指定账户的交易
get_account_recent_trades(account_id=1)
```

**返回数据结构：**
```json
{
  "status": "ok",
  "account_id": null,
  "date_range": {
    "from": "2026-05-07",
    "to": "2026-05-14"
  },
  "trade_count": 5,
  "trades": [
    {
      "trade_id": 123,
      "trade_date": "2026-05-14",
      "symbol": "SH600519",
      "side": "buy",
      "quantity": 2000,
      "price": 26.87,
      "amount": 53740.0,
      "fee": 10.0,
      "tax": 0.0,
      "note": "加仓长江电力"
    }
  ]
}
```

## 使用建议

### 场景1：查看当前持仓状态
**问AI：** "我现在持有哪些股票？仓位如何？"

**AI会使用：** `get_current_positions()`

**你会得到：**
- 所有持仓的股票代码、数量、成本价、最新价
- 今日是否执行了交易
- 价格数据来源说明

### 场景2：复盘今日操作
**问AI：** "我今天做了哪些交易？"

**AI会使用：** `get_account_recent_trades(days=1)`

**你会得到：**
- 今日所有买入/卖出记录
- 每笔交易的价格、数量、金额
- 手续费和税费明细

### 场景3：分析某只股票的交易历史
**问AI：** "我最近对长江电力做了什么操作？"

**AI会使用：** `get_account_recent_trades(symbol="600519", days=30)`

**你会得到：**
- 近30天内对该股票的所有操作
- 可以计算平均成交价、总投入等

### 场景4：对比持仓变化和交易记录
**问AI：** "我的持仓为什么和昨天不一样？"

**AI会结合使用：**
1. `get_current_positions()` - 看当前持仓
2. `get_account_recent_trades(days=7)` - 看近期交易

**你会得到：**
- 持仓变化的完整解释
- 哪些交易导致了持仓变化

## 价格数据说明

### 为什么价格还是昨天的？

系统在计算持仓市值时，优先使用**已确认的收盘价**，原因如下：

1. **稳定性**：收盘价是经过市场确认的最终价格，不会波动
2. **一致性**：避免因盘中价格波动导致持仓估值频繁跳变
3. **审计性**：便于事后核对和审计

### 价格来源字段说明

每个持仓都有以下价格相关字段：

- `price_source`: 
  - `"history_close"` - 历史收盘价（最常用）
  - `"realtime_quote"` - 实时行情价格
  - `"missing"` - 无法获取价格

- `price_date`: 价格对应的日期

- `price_stale`: 价格是否过期（超过1天未更新）

- `price_available`: 是否有可用价格

### 如果需要实时价格

如果你确实需要今天的实时价格来估算持仓价值，可以：

1. **单独查询实时行情：**
   ```python
   get_realtime_quote(stock_code="600519")
   ```

2. **手动计算：**
   ```
   实时市值 = 持仓数量 × 实时价格
   ```

## 技术实现细节

### 数据流程

1. **持仓数量计算**（准确反映今日交易）：
   ```
   数据库中的所有交易记录 → 按时间排序 → 逐笔回放 → 得出当前持仓数量
   ```

2. **价格获取逻辑**：
   ```
   尝试获取 as_of_date - 1 的收盘价
   ↓ 如果失败
   尝试获取实时价格（仅当 as_of_date = 今天时）
   ↓ 如果失败
   标记为价格缺失
   ```

3. **今日交易查询**：
   ```
   查询数据库中 trade_date = 今天的所有记录
   ↓
   按时间倒序排列
   ↓
   返回给AI展示
   ```

### 数据库表结构

相关的主要表：
- `portfolio_trade` - 交易记录表
- `portfolio_position` - 持仓缓存表
- `portfolio_daily_snapshot` - 每日快照表
- `stock_daily` - 股票日线数据表（用于获取收盘价）

## 测试验证

运行测试脚本验证新功能：
```bash
python tests/test_new_portfolio_tools.py
```

预期输出：
- ✅ 能正确显示当前持仓（包含今日交易后的数量）
- ✅ 能正确显示今日执行的交易明细
- ✅ 价格字段有明确的来源和日期标注

## 后续优化建议

1. **增强实时价格支持**：
   - 可配置是否在持仓快照中使用实时价格
   - 添加实时价格更新时间戳

2. **添加持仓变动通知**：
   - 当检测到今日有新交易时，主动提醒用户

3. **改进价格新鲜度提示**：
   - 如果价格超过2天未更新，给出警告
   - 提供手动刷新价格的接口

4. **增加成交均价计算**：
   - 对于多次买入同一股票，显示加权平均成交价
   - 帮助判断当前盈亏情况

## 常见问题

### Q1: 为什么我录入交易后，AI还是说数据没更新？
**A:** 请确保使用新的工具 `get_current_positions` 而不是旧的 `get_portfolio_snapshot`。新工具会明确显示今日交易。

### Q2: 持仓数量和实际不符怎么办？
**A:** 检查以下几点：
1. 交易是否正确录入数据库
2. 交易的 `trade_date` 是否正确
3. 是否有重复录入的交易
4. 使用 `get_account_recent_trades` 核对交易记录

### Q3: 能否强制使用今天的实时价格？
**A:** 目前设计上优先使用收盘价以确保稳定性。如需实时价格，可以单独调用 `get_realtime_quote` 获取。

### Q4: 如何删除错误的交易记录？
**A:** 需要通过API或Web界面删除交易记录，然后重新查询持仓。AI工具目前只提供查询功能。

## 总结

通过新增的两个工具，你现在可以：
- ✅ 准确获取包含今日交易的当前持仓
- ✅ 查看今日或近期的所有交易明细
- ✅ 理解价格数据的来源和时效性
- ✅ 更好地向AI提问并获得准确的回答

这解决了原来"系统数据没有反映今日操作"的问题，让AI能够基于真实的数据库信息进行分析和复盘。
