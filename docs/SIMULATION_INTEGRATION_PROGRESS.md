# Portfolio-Simulation 账户整合实施进度

**更新时间**: 2026-05-16  
**分支**: `feature/simulation-trading-stage1`

---

## ✅ 已完成的工作

### 1. 数据库层（Step 1.5）✅
- [x] 修改 `src/storage.py` - `PortfolioAccount` 模型增加 `account_type` 字段
- [x] 添加 `ix_portfolio_account_type` 索引优化查询
- [x] 创建迁移脚本 `scripts/migrate_add_account_type.py`
- [x] 成功执行迁移，更新 5 条现有记录为 `account_type='real'`

**提交**: `7e8edfe feat: add account_type field to portfolio_accounts table`

### 2. Repository 层（Step 1.6）✅
- [x] 修改 `src/repositories/portfolio_repo.py`
  - `create_account()` 增加 `account_type` 参数（默认 'real'）
  - `list_accounts()` 支持按 `account_type` 过滤

**提交**: `a676a1b feat: add account_type support to Repository, Service and API layers`

### 3. Service 层（Step 1.7）✅
- [x] 修改 `src/services/portfolio_service.py`
  - `create_account()` 增加 `account_type` 参数
  - `list_accounts()` 支持 `account_type` 过滤

### 4. API Schema & Endpoint（Step 1.8）✅
- [x] 修改 `api/v1/schemas/portfolio.py`
  - `PortfolioAccountCreate` 增加 `account_type` 字段
- [x] 修改 `api/v1/endpoints/portfolio.py`
  - `/accounts` POST 接口支持 `account_type` 参数
  - `/accounts` GET 接口支持按类型过滤

### 5. SimulationTradingService 重构（Step 1.9）✅
- [x] 修改 `src/services/simulation_trading_service.py`
  - 移除独立的内存账户管理
  - 使用 `PortfolioService` 进行账户 CRUD
  - `create_account()` 改为调用 `portfolio_service.create_account(account_type='simulation')`
  - `list_accounts()` 改为调用 `portfolio_service.list_accounts(account_type='simulation')`
  - `execute_trade()` 改为调用 `portfolio_service.create_trade()`

**提交**: `af6226a refactor: migrate SimulationTradingService to use Portfolio Service`

### 6. SimulationScheduler 改造（Step 1.10）✅
- [x] 修改 `src/services/simulation_scheduler.py`
  - `generate_daily_suggestions()` 使用 `portfolio_service.list_accounts(account_type='simulation')`
  - `midday_check()` 同样按类型过滤
  - `generate_daily_review()` 同样按类型过滤

**提交**: `aed1e04 refactor: update SimulationScheduler to filter simulation accounts`

### 7. 前端适配（Step 1.11）✅
- [x] 修改 `apps/dsa-web/src/pages/SimulationTradingPage.tsx`
  - 替换 `simulationApi` 为 `portfolioApi`
  - 通过账户名称过滤模拟账户（包含"模拟"或"Sim"）
  - 使用 `portfolioApi.getSnapshot()` 获取实时持仓和资金数据
  - 交易执行改为调用 `portfolioApi.createTrade()`
  - 暂时禁用调度器和交易建议功能（标记 TODO）
  - 更新 UI 显示快照数据（总权益、实现/未实现盈亏等）

**提交**: `dd1620c feat: adapt SimulationTradingPage to use Portfolio API and snapshot data`

---

## 📋 待完成的工作

### 后端补充任务

#### Step 1.12: 创建模拟账户的便捷入口 ⏳
**目标**: 在 `/portfolio` 页面提供快速创建模拟账户的功能

**需要修改的文件**:
- `apps/dsa-web/src/pages/PortfolioPage.tsx`
  - 在"创建账户"表单中增加 `account_type` 选择器（真实/模拟）
  - 或者提供单独的"创建模拟账户"按钮

**验收标准**:
- 用户可以在 Portfolio 页面直接创建模拟账户
- 新创建的模拟账户自动设置 `account_type='simulation'`
- 前端列表能正确区分真实账户和模拟账户

---

#### Step 1.13: 完善交易建议生成逻辑 ⏳
**目标**: 基于 Portfolio 的交易记录生成智能交易建议

**需要修改的文件**:
- `src/services/simulation_trading_service.py`
  - 实现 `generate_trading_suggestion()` 方法
  - 读取账户持仓、历史交易、市场数据
  - 调用 LLM 或策略引擎生成建议

**验收标准**:
- 能够根据持仓和市场情况生成买卖建议
- 建议包含股票代码、方向、价格区间、理由
- 前端 `/simulation` 页面能正常显示建议

---

#### Step 1.14: 恢复调度器功能 ⏳
**目标**: 实现基于 Portfolio 的定时任务调度

**需要修改的文件**:
- `src/services/simulation_scheduler.py`
  - 实现真实的定时任务逻辑
  - 每日早盘前生成交易建议
  - 午间检查持仓风险
  - 盘后生成复盘报告

**验收标准**:
- 调度器能按时触发任务
- 任务执行结果写入数据库
- 前端能查看历史建议记录

---

### 前端补充任务

#### Step 1.15: 增强模拟账户识别逻辑 ⏳
**当前问题**: 前端通过名称匹配（包含"模拟"或"Sim"）来识别模拟账户，不够可靠

**改进方案**:
- 方案 A: 后端 API 返回 `accountType` 字段，前端直接使用
- 方案 B: 前端在创建账户时自动添加标识（如"【模拟】"前缀）

**需要修改的文件**:
- `apps/dsa-web/src/api/portfolio.ts` - 确保返回 `accountType`
- `apps/dsa-web/src/types/portfolio.ts` - 类型定义增加 `accountType`
- `apps/dsa-web/src/pages/SimulationTradingPage.tsx` - 改用字段过滤

---

#### Step 1.16: 交易执行界面优化 ⏳
**目标**: 提供更友好的交易执行体验

**需要改进**:
- 实时显示可用资金和可买数量
- 自动计算手续费和税费
- 买入/卖出时校验 T+1 规则
- 显示预估成交金额

**需要修改的文件**:
- `apps/dsa-web/src/pages/SimulationTradingPage.tsx`
  - 交易表单增加实时计算逻辑
  - 调用后端接口获取实时行情
  - 显示费用明细

---

## 🔧 技术要点总结

### 数据库变更
```sql
ALTER TABLE portfolio_accounts 
ADD COLUMN account_type TEXT DEFAULT 'real' 
CHECK(account_type IN ('real', 'simulation'));

CREATE INDEX idx_accounts_type ON portfolio_accounts(account_type);
```

### 核心架构决策
1. **共享数据模型**: 模拟账户和真实账户共用 `portfolio_accounts` 表
2. **轻量标识**: 通过 `account_type` 字段区分账户类型
3. **统一 API**: 前后端都使用 Portfolio API，按类型过滤
4. **持久化存储**: 所有交易记录存入 `portfolio_trades` 表，支持回测

### 关键代码片段

**后端创建模拟账户**:
```python
account = portfolio_service.create_account(
    name="模拟账户-测试",
    broker="模拟券商",
    market="cn",
    base_currency="CNY",
    account_type="simulation"  # 关键字段
)
```

**前端过滤模拟账户**:
```typescript
const simulationAccounts = data.accounts.filter(acc => 
  acc.name.includes('模拟') || acc.name.includes('Sim')
);
```

**前端获取账户快照**:
```typescript
const snapshot = await portfolioApi.getSnapshot({ accountId });
// snapshot.totalCash, snapshot.totalEquity, snapshot.positions...
```

---

## 🚀 下一步行动建议

### 立即可做（优先级高）
1. **测试现有功能**:
   - 在 `/portfolio` 创建模拟账户（名称包含"模拟"）
   - 在 `/simulation` 页面查看是否能识别该账户
   - 尝试执行一笔模拟交易
   - 检查持仓和资金是否正确更新

2. **修复已知问题**:
   - 前端账户识别逻辑不够可靠（依赖名称匹配）
   - 调度器和交易建议功能暂时不可用

### 短期计划（1-2 天）
1. 实现 Step 1.12 - Portfolio 页面创建模拟账户的便捷入口
2. 实现 Step 1.15 - 增强模拟账户识别逻辑（后端返回 `accountType`）
3. 完善 Step 1.13 - 基础版交易建议生成（简单规则引擎）

### 中期计划（3-5 天）
1. 实现 Step 1.14 - 恢复调度器完整功能
2. 实现 Step 1.16 - 交易执行界面优化
3. 编写单元测试覆盖核心流程

---

## 📝 注意事项

1. **账户命名约定**: 目前前端通过名称识别模拟账户，建议在创建时统一使用"模拟"或"Sim"前缀
2. **交易记录**: 所有模拟交易都会写入 `portfolio_trades` 表，与真实交易混存，但通过 `account_id` 区分
3. **调度器状态**: 当前调度器功能已暂时禁用，后续需要重新实现
4. **回滚方式**: 如需回滚，可使用 git revert 撤销最近的 5 个提交

---

## 📊 完成度统计

| 阶段 | 任务数 | 已完成 | 完成率 |
|------|--------|--------|--------|
| 数据库层 | 1 | 1 | 100% |
| Repository 层 | 1 | 1 | 100% |
| Service 层 | 1 | 1 | 100% |
| API 层 | 1 | 1 | 100% |
| Simulation 服务重构 | 2 | 2 | 100% |
| 前端适配 | 1 | 1 | 100% |
| **核心整合** | **7** | **7** | **100%** |
| 补充功能 | 5 | 0 | 0% |
| **总计** | **12** | **7** | **58%** |

**核心架构整合已完成！** 剩余工作主要是功能完善和用户体验优化。
