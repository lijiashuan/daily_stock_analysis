# 持仓数据查询功能更新

## 更新日期
2026-05-14

## 更新内容

本次更新完善了AI获取持仓数据和交易数据的功能，解决了"系统数据没有反映今日操作"的问题。

### 新增工具

#### 1. `get_current_positions` - 获取当前持仓信息

**功能：**
- ✅ 从数据库获取包含今日交易的当前持仓
- ✅ 显示每个持仓的最新可用价格及来源
- ✅ 可选显示今日执行的所有交易明细
- ✅ 提供持仓汇总信息（总资产、市值、现金、盈亏等）

**使用方式：**
```python
# AI会自动调用
get_current_positions(account_id=None, cost_method="fifo", include_today_trades=True)
```

#### 2. `get_account_recent_trades` - 获取近期交易记录（已存在，已完善）

**功能：**
- ✅ 从数据库查询指定日期范围内的所有交易记录
- ✅ 支持按账户ID、股票代码过滤
- ✅ 返回完整的交易信息（价格、数量、手续费、税费等）

**使用方式：**
```python
# AI会自动调用
get_account_recent_trades(account_id=None, days=7, symbol=None)
```

## 解决的问题

### 原问题
> "系统返回的仍然是昨日（5月13日）收盘后的静态数据，没有反映您今天录入的交易。"

### 解决方案

1. **持仓数量**：✅ 已正确反映今日交易
   - 通过交易回放机制，自动计算包含今日交易的持仓数量
   
2. **价格数据**：⚠️ 仍使用昨日收盘价（这是设计选择）
   - 原因：收盘价是经过市场确认的最终价格，更稳定可靠
   - 解决方案：明确标注 `price_source` 和 `price_date`，让用户知情
   - 如需实时价格：可单独调用 `get_realtime_quote`

3. **今日交易明细**：✅ 新增展示
   - `get_current_positions` 可选择性返回 `today_trades`
   - AI可以清楚看到今天执行了哪些操作

## 修改的文件

1. **src/agent/tools/data_tools.py**
   - 新增 `_handle_get_current_positions()` 函数
   - 新增 `get_current_positions_tool` 定义
   - 将新工具注册到 `ALL_DATA_TOOLS` 列表

2. **tests/test_new_portfolio_tools.py**（新建）
   - 测试脚本，验证新功能是否正常工作

3. **docs/PORTFOLIO_DATA_QUERY_GUIDE.md**（新建）
   - 详细的功能说明和使用指南

4. **docs/PORTFOLIO_AI_QUERY_EXAMPLES.md**（新建）
   - AI提问示例和最佳实践

## 使用示例

### 查看当前持仓
**用户问：** "请帮我查看当前的持仓情况，包括今天录入的交易。"

**AI会：** 调用 `get_current_positions()`，返回包含今日交易的持仓信息

### 查看今日交易
**用户问：** "我今天做了哪些交易？"

**AI会：** 调用 `get_account_recent_trades(days=1)`，返回今日所有交易明细

### 复盘操作
**用户问：** "我今天减仓了兰石重装，这个操作怎么样？"

**AI会：** 
1. 调用 `get_account_recent_trades(days=1, symbol="600863")` 获取交易详情
2. 调用 `get_current_positions()` 获取最新持仓
3. 调用 `get_realtime_quote(stock_code="600863")` 获取实时价格
4. 综合分析并给出建议

## 技术实现

### 持仓数量计算
系统通过以下方式确保持仓数量包含今日交易：

```python
# 1. 从数据库查询所有 <= as_of_date 的交易记录
trades = self.repo.list_trades(account.id, as_of=as_of_date)

# 2. 按时间排序（现金 -> 公司行为 -> 交易）
events.sort(key=lambda item: (item[1], event_priority[item[0]], item[2]))

# 3. 逐笔回放，计算持仓
for event in events:
    if side == "buy":
        quantity_held += qty  # 买入增加持仓
    elif side == "sell":
        quantity_held -= qty  # 卖出减少持仓

# 4. 返回最终持仓数量（包含今日交易）
```

### 价格获取逻辑
```python
# 1. 优先使用 as_of_date - 1 的历史收盘价
cutoff_date = as_of_date - timedelta(days=1)
close = self.repo.get_latest_close_with_date(symbol, as_of=cutoff_date)

if close is not None:
    return _ResolvedPositionPrice(
        price=close_price,
        source="history_close",  # 标注为历史收盘价
        price_date=close_date,
        is_stale=close_date < cutoff_date,
        is_available=True
    )

# 2. 如果查询的是今天且没有历史价格，尝试实时价格
if as_of_date == today:
    realtime_price = self._fetch_realtime_position_price(symbol)
    if realtime_price:
        return _ResolvedPositionPrice(
            price=realtime_price,
            source="realtime_quote",  # 标注为实时价格
            price_date=today,
            is_stale=False,
            is_available=True
        )
```

## 测试验证

运行测试脚本：
```bash
python tests/test_new_portfolio_tools.py
```

预期输出：
- ✅ 能正确显示当前持仓（包含今日交易后的数量）
- ✅ 能正确显示今日执行的交易明细
- ✅ 价格字段有明确的来源和日期标注

## 注意事项

1. **价格时效性**
   - 持仓中的价格通常是昨天的收盘价
   - 如需实时估值，请单独查询实时行情
   - 系统会在价格超过2天未更新时给出警告

2. **数据一致性**
   - 持仓数量是基于所有历史交易计算的
   - 确保交易记录的日期、数量、价格准确
   - 错误的交易会导致持仓计算错误

3. **多账户管理**
   - 如果有多个账户，注意指定 `account_id`
   - 不指定时会汇总所有活跃账户

## 相关文档

- [详细功能说明](./PORTFOLIO_DATA_QUERY_GUIDE.md)
- [AI使用示例](./PORTFOLIO_AI_QUERY_EXAMPLES.md)

## 后续优化建议

1. 增强实时价格支持
2. 添加持仓变动通知
3. 改进价格新鲜度提示
4. 增加成交均价计算

---

**更新完成时间：** 2026-05-14  
**影响范围：** AI工具层（`src/agent/tools/data_tools.py`）  
**向后兼容：** ✅ 完全兼容，不影响现有功能
