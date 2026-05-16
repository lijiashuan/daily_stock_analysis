# 模拟交易系统开发计划

> 创建时间: 2026-05-16  
> 最后更新: 2026-05-16（架构调整）
> 目标: 分阶段实现日内波段量化交易模拟系统  
> 原则: 小步快跑、及时验证、降低风险

---

## 🔄 架构调整说明（2026-05-16）

### 重要决策：Portfolio 与 Simulation 账户共享

经过全面评估，决定采用**"共享+轻量标识"方案**，将模拟账户整合到 Portfolio 系统中：

#### 核心变更

1. **数据库层面**
   - `portfolio_accounts` 表增加 `account_type` 字段（'real' / 'simulation'）
   - 模拟账户和真实账户共用同一套表结构
   - 通过 `account_type` 区分账户类型

2. **后端层面**
   - `SimulationTradingService` 重构为使用 `PortfolioService`
   - 废弃独立的 `/api/v1/simulation/accounts` API
   - 前端统一调用 Portfolio API，按 `account_type` 过滤

3. **前端层面**
   - `/portfolio` 页面增加账户类型选择（实盘/模拟）
   - `/simulation` 页面保留，但数据来自 Portfolio API
   - 模拟账户有明显标识（🎮 图标）

#### 优势

- ✅ 代码复用：只需维护一套账户 CRUD 逻辑
- ✅ 数据一致：模拟和真实使用相同的交易规则
- ✅ 回测便利：直接使用 Portfolio 的交易记录
- ✅ 未来扩展：模拟账户可无缝切换到真实券商

#### 实施步骤

详见下方**第一阶段补充任务**。

---

## 📋 项目概述

### 核心功能
构建一个自动化模拟交易系统，支持：
1. **智能选股** - 多维度评估股票质量
2. **集合竞价分析** - 利用早盘信号预测区间
3. **日内波段交易** - 高抛低吸赚取差价
4. **配对交易管理** - 自动匹配买卖订单
5. **多策略并行** - 保守/平衡/激进三种模式
6. **自动复盘** - 日/周/月报自动生成

### 技术架构
- **后端**: Python + FastAPI（与现有项目一致）
- **前端**: React 19 + TypeScript + Tailwind CSS（复用 dsa-web 技术栈）
- **数据**: SQLite（账户数据）+ JSON文件（配置和日志）
- **调度**: schedule 库（与现有项目一致）+ 后台线程池
- **通知**: 复用现有通知系统
- **数据源**: DataProvider 抽象层（支持 Mock/AkShare/Tushare 等）

---

## 🎯 分阶段实施计划

### 第一阶段：核心数据结构与基础服务（预计 2-3 天）

**目标**: 建立数据模型和基础服务框架，不依赖前端

#### 任务清单

- [ ] **1.1 创建数据模型与数据抽象层**
  - [ ] `DataProvider` 抽象基类（统一数据接口）
  - [ ] `MockDataProvider`（模拟数据，用于开发测试）
  - [ ] `AkShareDataProvider`（真实数据源实现）
  - [ ] 数据缓存机制（SQLite/Parquet）
  - [ ] `BaseAccount` - 账户抽象基类（支持模拟/真实账户切换）
  - [ ] `SimulationAccount` - 模拟账户实现
  - [ ] `TradeLeg` - 交易腿（单笔交易）
  - [ ] `PairedTrade` - 配对交易（初期一对一，预留一对多扩展）
  - [ ] `StrategyType` - 策略类型枚举
  - [ ] `TradingMode` - 交易模式枚举
  
  **文件**: 
  - `src/data_provider/base.py`
  - `src/data_provider/mock_provider.py`
  - `src/data_provider/akshare_provider.py`
  - `src/schemas/simulation_models.py`
  
  **设计原则**:
  - 账户采用抽象基类设计，后期可通过配置切换到真实券商账户
  - 配对交易初期实现一对一，但数据结构支持未来扩展到一对多/多对一
  - 所有核心逻辑依赖接口而非具体实现
  - 数据源抽象化，避免后期切换时的返工
  - 历史数据本地缓存，支持离线开发
  
  **验收标准**:
  - 所有数据类可正常实例化
  - 字段类型正确
  - 包含必要的验证逻辑
  - 账户接口设计支持未来扩展
  - Mock 和真实数据源可无缝切换

- [ ] **1.2 实现配对交易管理器（订单簿模型）**
  - [ ] 买单池/卖单池结构
  - [ ] 价格时间优先撮合引擎
  - [ ] 部分成交处理
  - [ ] 强制平仓逻辑（持仓过夜、止损线、流动性不足）
  - [ ] 单元测试覆盖核心逻辑
  
  **文件**: `src/strategies/paired_trade_manager.py`
  
  **验收标准**:
  - 支持一对一、一对多、多对一配对
  - 能正确处理部分成交场景
  - 强制平仓逻辑有明确触发条件
  - 单元测试覆盖率 > 80%

- [ ] **1.3 实现T+1交易引擎（简化版）**
  - [ ] 底仓初始化
  - [ ] 单次配对模式
  - [ ] 可用持仓管理
  
  **文件**: `src/strategies/t1_trading_engine.py`
  
  **验收标准**:
  - 能正确初始化底仓
  - 能生成简单的买卖建议
  - 遵守T+1规则

- [ ] **1.4 创建模拟交易服务（并发安全）**
  - [ ] 账户CRUD操作
  - [ ] SQLite持久化存储（替代JSON文件，保证并发安全）
  - [ ] 加载已有账户
  - [ ] 线程锁机制（防止并发修改冲突）
  - [ ] 数据版本号乐观锁
  
  **文件**: `src/services/simulation_trading_service.py`
  
  **验收标准**:
  - 能创建/删除账户
  - 账户数据保存到SQLite数据库
  - 重启后能加载账户
  - 支持并发访问（前端请求 + 定时任务）
  - 事务完整性保证

#### 测试用例
```python
# tests/test_simulation_basic.py
def test_create_account():
    """测试创建账户"""
    service = SimulationTradingService()
    account = service.create_account(
        account_name="测试账户",
        strategy_type=StrategyType.BALANCED,
        initial_capital=100000,
        stock_code="600519"
    )
    assert account.account_id is not None
    assert account.current_capital == 100000

def test_paired_trade():
    """测试配对交易"""
    manager = PairedTradeManager("600519")
    
    # 添加买单
    buy = manager.add_trade(TradeType.BUY, 100.0, 1000, datetime.now())
    
    # 添加卖单（应自动配对）
    sell = manager.add_trade(TradeType.SELL, 103.0, 1000, datetime.now())
    
    # 验证配对成功
    assert manager.stats['paired_count'] == 1
    assert manager.paired_trades[0].profit > 0
```

#### 交付物
- ✅ 核心数据模型
- ✅ 配对交易管理器（含测试）
- ✅ T+1引擎（基础版）
- ✅ 模拟交易服务
- ✅ 单元测试覆盖率 > 70%

---

### 第一阶段补充：Portfolio 与 Simulation 账户整合（预计 2-3 天）

**目标**: 将模拟账户整合到 Portfolio 系统，实现数据持久化和共享

#### 任务清单

- [ ] **1.5 数据库迁移 - 增加 account_type 字段**
  - [ ] 修改 `src/storage.py` 中 `PortfolioAccount` 模型
  - [ ] 添加 `account_type` 字段（String(16), default='real'）
  - [ ] 添加 CHECK 约束和索引
  - [ ] 编写数据库迁移脚本
  
  **文件**: 
  - `src/storage.py`
  - `scripts/migrate_add_account_type.py`（新建）
  
  **验收标准**:
  - 现有账户默认 `account_type='real'`
  - 新创建账户可指定类型
  - 数据库查询性能不受影响

- [ ] **1.6 Repository 层改造**
  - [ ] `PortfolioRepository.create_account()` 增加 `account_type` 参数
  - [ ] `PortfolioRepository.list_accounts()` 支持按类型过滤
  - [ ] 更新相关查询方法
  
  **文件**: `src/repositories/portfolio_repo.py`
  
  **验收标准**:
  - 能创建模拟账户
  - 能分别查询实盘/模拟账户
  - 向后兼容（不传参数时默认为 real）

- [ ] **1.7 Service 层改造**
  - [ ] `PortfolioService.create_account()` 增加 `account_type` 参数
  - [ ] `PortfolioService.list_accounts()` 支持按类型过滤
  - [ ] 增加账户类型校验逻辑
  
  **文件**: `src/services/portfolio_service.py`
  
  **验收标准**:
  - API 层能正确传递 account_type
  - 业务逻辑层有类型校验
  - 错误提示清晰

- [ ] **1.8 API 层改造**
  - [ ] `PortfolioAccountCreateRequest` 增加 `account_type` 字段
  - [ ] `PortfolioAccountItem` 返回 `account_type`
  - [ ] API 文档更新
  
  **文件**: 
  - `api/v1/schemas/portfolio.py`
  - `api/v1/endpoints/portfolio.py`
  
  **验收标准**:
  - Swagger 文档显示新字段
  - 前端能正确提交和接收 account_type
  - 默认值为 'real'

- [ ] **1.9 SimulationTradingService 重构**
  - [ ] 改为使用 `PortfolioService` 作为数据源
  - [ ] `create_account()` 调用 Portfolio API
  - [ ] `list_accounts()` 过滤 simulation 类型
  - [ ] `execute_trade()` 调用 Portfolio 交易接口
  - [ ] 保留 `SimulationAccount` 作为视图层
  
  **文件**: `src/services/simulation_trading_service.py`
  
  **验收标准**:
  - 模拟账户创建后在 Portfolio 中可见
  - 交易记录持久化到 portfolio_trades 表
  - 重启服务后账户不丢失
  - 回测能读取历史交易记录

- [ ] **1.10 Scheduler 改造**
  - [ ] `SimulationScheduler` 按 account_type 过滤账户
  - [ ] 通知标题增加 [模拟] 标识
  - [ ] 双重校验防止误发实盘账户
  
  **文件**: `src/services/simulation_scheduler.py`
  
  **验收标准**:
  - 定时任务只处理模拟账户
  - 日志中有明确的类型检查
  - 不会给实盘账户发送模拟建议

- [ ] **1.11 前端 - Portfolio 页面改造**
  - [ ] 创建账户表单增加类型选择（Radio Group）
  - [ ] 账户列表显示类型标识（🎮 模拟 / 💼 实盘）
  - [ ] TypeScript 类型定义更新
  
  **文件**: 
  - `apps/dsa-web/src/pages/PortfolioPage.tsx`
  - `apps/dsa-web/src/types/portfolio.ts`
  - `apps/dsa-web/src/api/portfolio.ts`
  
  **验收标准**:
  - 用户能选择创建实盘或模拟账户
  - 列表中清晰区分两种账户
  - 模拟账户有视觉标识

- [ ] **1.12 前端 - Simulation 页面适配**
  - [ ] 改为调用 Portfolio API
  - [ ] 过滤 account_type='simulation' 的账户
  - [ ] 保持原有 UI 和交互
  
  **文件**: 
  - `apps/dsa-web/src/pages/SimulationTradingPage.tsx`
  - `apps/dsa-web/src/api/simulation.ts`（可选废弃）
  
  **验收标准**:
  - 页面正常加载模拟账户
  - 交易执行功能正常
  - 数据持久化生效

#### 测试用例
```python
# tests/test_portfolio_simulation_integration.py
def test_create_simulation_account():
    """测试创建模拟账户"""
    service = PortfolioService()
    account = service.create_account(
        name="模拟-茅台日内",
        broker="模拟券商",
        market="cn",
        base_currency="CNY",
        account_type="simulation"
    )
    assert account['account_type'] == 'simulation'

def test_list_simulation_accounts():
    """测试列出模拟账户"""
    service = PortfolioService()
    accounts = service.list_accounts(account_type="simulation")
    for acc in accounts:
        assert acc['account_type'] == 'simulation'

def test_simulation_trade_persistence():
    """测试模拟交易持久化"""
    # 创建模拟账户
    account = portfolio_service.create_account(..., account_type="simulation")
    
    # 执行交易
    trade = portfolio_service.record_trade(
        account_id=account['id'],
        symbol="600519",
        side="buy",
        quantity=100,
        price=1800.0,
        ...
    )
    
    # 验证交易已保存
    trades = portfolio_service.list_trades(account_id=account['id'])
    assert len(trades) > 0
    assert trades[0]['symbol'] == "600519"
```

#### 交付物
- ✅ 数据库迁移完成（account_type 字段）
- ✅ Portfolio 和 Simulation 后端改造完成
- ✅ 前端两个页面适配完成
- ✅ 定时任务安全改造完成
- ✅ 集成测试通过
- ✅ 文档更新（本文档 + CHANGELOG）

---

### 第二阶段：策略算法实现与简易回测（预计 3-4 天）

**目标**: 实现核心策略算法，并尽早引入回测验证

#### 任务清单

- [ ] **2.1 实现选股器**
  - [ ] 流动性评分
  - [ ] 波动性评分
  - [ ] 机构持仓稳定性
  - [ ] 趋势健康度
  - [ ] 操纵风险评估
  
  **文件**: `src/strategies/stock_selector.py`
  
  **验收标准**:
  - 能对给定股票打分
  - 评分范围 0-1
  - 能识别高风险股票

- [ ] **2.2 实现集合竞价分析器**
  - [ ] 竞价强度计算
  - [ ] 买卖压力比
  - [ ] 价格发现质量
  - [ ] 当日区间预测
  
  **文件**: `src/strategies/call_auction_analyzer.py`
  
  **验收标准**:
  - 能解析竞价数据（先用模拟数据）
  - 输出预测高低点
  - 输出置信度

- [ ] **2.3 实现市场参与者分析器**
  - [ ] 主力行为识别
  - [ ] 机构行为识别
  - [ ] 散户行为识别
  - [ ] 主导模式判断
  
  **文件**: `src/strategies/market_participant_analyzer.py`
  
  **验收标准**:
  - 能识别庄股特征
  - 能判断市场主导力量
  - 给出操作建议

- [ ] **2.4 实现日内波段策略**
  - [ ] ATR计算
  - [ ] 布林带预测
  - [ ] 网格订单生成
  - [ ] 混合模式实现
  
  **文件**: `src/strategies/intraday_swing.py`
  
  **验收标准**:
  - 能基于历史数据预测区间
  - 能生成网格订单
  - 支持三种交易模式

- [ ] **2.5 策略接口标准化**
  - [ ] 定义统一策略接口 `generate_signals(df)` 
  - [ ] 所有策略实现该接口
  - [ ] 参数外置化（配置文件管理）
  - [ ] 确保可被回测引擎直接调用
  
  **文件**: `src/strategies/base_strategy.py`
  
  **验收标准**:
  - 策略与回测引擎解耦
  - 参数可通过配置文件调整
  - 新增策略只需实现接口

- [ ] **2.6 简易回测脚本（尽早验证）**
  - [ ] 单策略历史收益计算
  - [ ] 基础指标：胜率、最大回撤、Sharpe比率
  - [ ] 不依赖前端，命令行运行
  - [ ] 快速验证策略有效性
  
  **文件**: `scripts/simple_backtest.py`
  
  **验收标准**:
  - 能运行完整回测
  - 输出关键指标报告
  - 支持参数调整

#### 测试用例
```python
# tests/test_strategies.py
@pytest.mark.network
def test_stock_selection():
    """测试选股功能"""
    selector = QualityStockSelector()
    fetcher = AkShareFetcher()
    
    df = fetcher.get_stock_history("600519", ...)
    score = selector.evaluate_stock(df, {...})
    
    assert 0 <= score.total_score <= 1
    assert score.liquidity_score > 0

def test_daily_prediction():
    """测试每日区间预测"""
    strategy = IntradaySwingStrategy()
    prediction = strategy.predict_daily_range(df)
    
    assert prediction['predicted_high'] > prediction['predicted_low']
    assert 0 <= prediction['confidence'] <= 1
```

#### 交付物
- ✅ 选股器
- ✅ 集合竞价分析器
- ✅ 市场参与者分析器
- ✅ 日内波段策略
- ✅ 每日建议生成功能
- ✅ 策略层单元测试

---

### 第三阶段：后端API接口（预计 2 天）

**目标**: 暴露REST API，供前端调用

#### 任务清单

- [ ] **3.1 创建API路由**
  - [ ] POST `/api/v1/simulation/accounts` - 创建账户
  - [ ] GET `/api/v1/simulation/accounts` - 列出账户
  - [ ] GET `/api/v1/simulation/accounts/{id}` - 账户详情
  - [ ] DELETE `/api/v1/simulation/accounts/{id}` - 删除账户
  
  **文件**: `api/v1/endpoints/simulation_trading.py`
  
  **验收标准**:
  - 所有端点可正常访问
  - 请求验证正确
  - 错误处理完善

- [ ] **3.2 实现建议相关接口**
  - [ ] POST `/api/v1/simulation/daily-suggestions` - 生成建议
  - [ ] GET `/api/v1/simulation/daily-suggestions/{date}` - 查询建议
  
  **验收标准**:
  - 能触发生成建议
  - 能返回格式化建议
  - 响应时间 < 5秒

- [ ] **3.3 实现交易执行接口**
  - [ ] POST `/api/v1/simulation/execute-trade` - 执行交易
  
  **验收标准**:
  - 能更新账户状态
  - 能记录交易历史
  - 资金和持仓计算正确

- [ ] **3.4 实现报告接口**
  - [ ] GET `/api/v1/simulation/reports/{period}` - 获取报告
  
  **验收标准**:
  - 支持 daily/weekly/monthly
  - 报告数据完整
  - 格式清晰

- [ ] **3.5 注册路由到主应用**
  - [ ] 在 `api/v1/api.py` 中注册
  - [ ] 添加API文档说明
  
  **验收标准**:
  - Swagger文档可见新接口
  - 可通过浏览器测试

#### 测试用例
```python
# tests/test_simulation_api.py
def test_create_account_api(client):
    """测试创建账户API"""
    response = client.post("/api/v1/simulation/accounts", json={
        "account_name": "测试",
        "strategy_type": "balanced",
        "initial_capital": 100000,
        "stock_code": "600519"
    })
    
    assert response.status_code == 200
    assert "account_id" in response.json()

def test_generate_suggestions_api(client):
    """测试生成建议API"""
    response = client.post(
        "/api/v1/simulation/daily-suggestions?stock_code=600519"
    )
    
    assert response.status_code == 200
    assert "suggestions" in response.json()
```

#### 交付物
- ✅ 完整的REST API
- ✅ Swagger文档
- ✅ API层测试
- ✅ 可通过Postman/curl测试

---

### 第四阶段：前端页面开发（预计 4-5 天，分两轮交付）

**目标**: 实现用户界面，可视化展示和操作

**交付策略**:
- **第一轮（2-3天）**: 核心功能（账户管理 + 建议查看 + 交易执行）
- **第二轮（2天）**: 增强功能（报告展示 + 图表优化 + 响应式）

#### 任务清单

- [ ] **4.1 创建路由和页面框架**
  - [ ] 添加路由 `/simulation-trading`（在 `apps/dsa-web/src/router/index.tsx`）
  - [ ] 创建页面组件 `SimulationTrading.tsx`
  - [ ] 添加导航菜单项
  - [ ] 复用 dsa-web 现有组件（表格、卡片、对话框）
  
  **文件**: 
  - `apps/dsa-web/src/router/index.tsx`
  - `apps/dsa-web/src/pages/SimulationTrading.tsx`
  
  **验收标准**:
  - 能访问页面
  - 菜单可见
  - 页面布局正常
  - 复用现有组件，减少开发量

- [ ] **4.2 实现账户概览卡片**
  - [ ] 显示所有账户
  - [ ] 展示关键指标（资金、持仓、收益）
  - [ ] 不同策略用不同颜色标识
  - [ ] 创建新账户对话框
  
  **验收标准**:
  - 账户信息实时显示
  - 点击可查看详情
  - 能创建新账户

- [ ] **4.3 实现今日建议展示**
  - [ ] 折叠面板展示各账户建议
  - [ ] 显示预测高低点
  - [ ] 显示操作指令（时间线）
  - [ ] 显示待配对池状态
  - [ ] 刷新按钮
  
  **验收标准**:
  - 建议清晰可读
  - 操作指令突出显示
  - 能手动刷新

- [ ] **4.4 实现交易执行功能**
  - [ ] 每个操作旁有"执行"按钮
  - [ ] 执行后更新账户状态
  - [ ] 显示执行结果提示
  
  **验收标准**:
  - 点击执行能调用API
  - 执行成功后刷新数据
  - 错误时有友好提示

- [ ] **4.5 实现复盘报告展示**
  - [ ] 日/周/月报切换
  - [ ] 账户维度tab切换
  - [ ] 统计图表（可选）
  - [ ] 改进建议列表
  
  **验收标准**:
  - 报告数据完整
  - 切换流畅
  - 关键指标突出

- [ ] **4.6 UI优化和响应式**
  - [ ] 适配不同屏幕
  - [ ] 加载状态
  - [ ] 空状态处理
  - [ ] 错误边界
  
  **验收标准**:
  - 移动端可用
  - 加载时有loading
  - 无数据时有提示

#### 交付物
- ✅ 完整的前端页面
- ✅ 响应式设计
- ✅ 良好的用户体验
- ✅ 与后端API对接完成

---

### 第五阶段：定时任务与通知（预计 2 天）

**目标**: 实现自动化调度和消息推送

#### 任务清单

- [ ] **5.1 实现调度器（可靠性增强）**
  - [ ] 复用现有 `src/scheduler.py` 的 Scheduler 类
  - [ ] 后台线程池执行（避免阻塞主事件循环）
  - [ ] 配置定时任务
  - [ ] 09:25 集合竞价分析
  - [ ] 09:30 生成建议
  - [ ] 15:05 日终清算
  - [ ] 15:30 发送日报
  - [ ] 周五16:00 发送周报
  - [ ] 任务持久化队列（SQLite记录执行状态）
  - [ ] 服务启动时补偿未执行任务
  
  **文件**: `src/services/simulation_scheduler.py`
  
  **验收标准**:
  - 任务按时触发
  - 日志记录完整
  - 异常不影响其他任务
  - 与现有 schedule 库兼容
  - 服务重启后能补偿错过的任务

- [ ] **5.2 集成通知系统**
  - [ ] 复用现有 NotificationService
  - [ ] 格式化日报消息
  - [ ] 格式化周报消息
  - [ ] 配置通知渠道
  
  **验收标准**:
  - 能收到日报推送
  - 消息格式清晰
  - 包含关键信息

- [ ] **5.3 实现极端行情处理**
  - [ ] 涨停/跌停检测
  - [ ] 部分执行处理
  - [ ] 待配对池管理
  - [ ] 强制平仓逻辑
  
  **文件**: `src/strategies/extreme_scenario_handler.py`
  
  **验收标准**:
  - 能识别极端情况
  - 给出处理建议
  - 自动执行强制平仓

- [ ] **5.4 启动脚本和配置**
  - [ ] 在 `server.py` 中启动调度器
  - [ ] 添加配置项（是否启用）
  - [ ]  graceful shutdown
  
  **验收标准**:
  - 服务启动时自动运行
  - 可通过配置关闭
  - 停止时清理资源

#### 交付物
- ✅ 定时任务调度器
- ✅ 自动通知功能
- ✅ 极端行情处理
- ✅ 完整的自动化流程

---

### 第六阶段：回测与优化（预计 4-5 天）

**目标**: 用历史数据验证策略，实现基础回测能力（自我进化作为可选功能）

#### 任务清单

- [ ] **6.1 实现回测引擎**
  - [ ] 加载历史数据
  - [ ] 模拟每日交易
  - [ ] 计算收益曲线
  - [ ] 统计关键指标
  
  **文件**: `src/strategies/intraday_backtester.py`
  
  **验收标准**:
  - 能运行完整回测
  - 输出收益报告
  - 计算最大回撤、胜率等

- [ ] **6.2 实现基础参数优化（简化版）**
  - [ ] 手动设置参数
  - [ ] 网格搜索最优参数（可选实验功能）
  - [ ] 保存历史最优参数
  - [ ] 过拟合检测（样本内外对比，简化版）
  
  **文件**: `src/strategies/strategy_optimizer.py`
  
  **验收标准**:
  - 能手动调整参数并回测
  - 网格搜索作为可选功能
  - 能检测明显过拟合

- [ ] **6.3 实现简化版市场状态检测器**
  - [ ] 使用简单波动率分位数
  - [ ] 趋势跟踪指标（均线排列）
  - [ ] 根据不同状态推荐参数（基础版）
  
  **文件**: `src/strategies/market_regime_detector.py`
  
  **验收标准**:
  - 能识别基本市场状态
  - 给出简单的参数建议
  - 不追求复杂模型

- [ ] **6.4 实现策略进化服务（推迟到第二期）**
  - [ ] 每日数据收集（仅记录日志）
  - [ ] 每周表现分析（生成报告，不自动优化）
  - [ ] 手动参数调整（不做自动优化）
  - [ ] ML模型重训练接口预留
  
  **文件**: `src/services/strategy_evolution_service.py`
  
  **验收标准**:
  - 能记录每日交易数据
  - 能生成周报复盘报告
  - 自动优化功能作为后续迭代

- [ ] **6.5 多策略对比**
  - [ ] 同时运行三种策略
  - [ ] 对比收益、风险
  - [ ] 生成对比报告
  
  **验收标准**:
  - 能并行运行多账户
  - 对比报告清晰
  - 给出推荐策略

- [ ] **6.6 回测可视化（可选）**
  - [ ] 收益曲线图
  - [ ] 回撤图
  - [ ] 交易分布图
  
  **验收标准**:
  - 图表直观
  - 可在前端展示

#### 交付物
- ✅ 回测引擎
- ✅ 参数优化功能
- ✅ 策略对比报告
- ✅ （可选）可视化图表

---

### 第七阶段：文档完善与部署（预计 2-3 天）

**目标**: 完善文档，准备上线

**文档策略**: 每个阶段完成后立即更新对应文档，避免积压到最后

#### 任务清单

- [ ] **7.1 编写用户文档**
  - [ ] 功能说明
  - [ ] 使用指南
  - [ ] 常见问题
  - [ ] 最佳实践
  
  **文件**: `docs/SIMULATION_TRADING_GUIDE.md`
  
  **验收标准**:
  - 新用户能看懂
  - 包含截图示例
  - 中英双语（可选）

- [ ] **7.2 编写技术文档**
  - [ ] 架构设计
  - [ ] API文档
  - [ ] 数据模型
  - [ ] 扩展指南
  
  **文件**: `docs/architecture/simulation_trading.md`
  
  **验收标准**:
  - 开发者能理解
  - 包含流程图
  - 关键决策说明

- [ ] **7.3 更新CHANGELOG**
  - [ ] 记录新功能
  - [ ] 按规范格式
  
  **文件**: `docs/CHANGELOG.md`
  
  **验收标准**:
  - 符合扁平格式
  - 类型标注正确

- [ ] **7.4 性能优化（前置到各阶段）**
  - [ ] API响应优化（第三阶段完成）
  - [ ] 数据库索引（第一阶段完成）
  - [ ] 前端加载优化（第四阶段完成）
  - [ ] 缓存机制（第一阶段数据源实现时完成）
  
  **验收标准**:
  - API响应 < 1秒
  - 页面加载 < 3秒
  - 无明显卡顿

- [ ] **7.5 最终测试**
  - [ ] 端到端测试
  - [ ] 边界情况测试
  - [ ] 压力测试（可选）
  
  **验收标准**:
  - 核心功能稳定
  - 无严重bug
  - 错误处理完善

#### 交付物
- ✅ 完整的用户文档
- ✅ 技术文档
- ✅ CHANGELOG更新
- ✅ 性能优化完成
- ✅ 通过最终测试

---

## 📊 进度跟踪

### 总体时间估算
| 阶段 | 预计天数 | 累计天数 | 状态 |
|------|---------|---------|------|
| 第一阶段 | 2-3 | 3 | ⏳ 待开始 |
| 第二阶段 | 3-4 | 7 | ⏳ 待开始 |
| 第三阶段 | 2 | 9 | ⏳ 待开始 |
| 第四阶段 | 4-5 | 14 | ⏳ 待开始 |
| 第五阶段 | 2 | 16 | ⏳ 待开始 |
| 第六阶段 | 4-5 | 21 | ⏳ 待开始 |
| 第七阶段 | 2-3 | 24 | ⏳ 待开始 |

**总计**: 约 3.5-4 周（按每天有效工作4-6小时计）

**优化说明**:
- 原计划 21 天，优化后调整为 24 天
- 增加数据抽象层、并发安全保障、任务可靠性机制
- 简化自我进化功能，推迟到第二期
- 前端分两轮交付，降低单次压力

### 里程碑
- ✅ **M1** (第3天): 核心数据结构+数据抽象层完成，能创建账户和配对交易
- ✅ **M2** (第7天): 策略算法完成+简易回测验证，能生成交易建议
- ✅ **M3** (第9天): API完成，可通过Postman测试
- ✅ **M4** (第14天): 前端核心功能完成（账户管理+建议查看+交易执行）
- ✅ **M5** (第16天): 自动化完成，每日自动推送建议
- ✅ **M6** (第21天): 基础回测完成，策略经过历史验证（自我进化作为可选）
- ✅ **M7** (第24天): 文档完善，系统可交付使用

---

## 🛠️ 开发规范

### 代码规范
- 遵循项目现有的 PEP 8 / ESLint 规范
- 函数要有 docstring
- 复杂逻辑要有注释
- 变量命名见名知意

### 提交规范
- commit message 使用英文
- 格式: `feat(simulation): add account management`
- 每个阶段完成后打tag: `v0.1.0-stage1`, `v0.2.0-stage2`...

### 测试规范
- 新增功能必须有测试
- 单元测试覆盖率 > 70%
- 核心逻辑覆盖率 > 90%

### 文档规范
- 新功能必须更新文档
- 重大变更更新 CHANGELOG
- 保持中英双语同步（可选）

---

## ⚠️ 风险与应对

### 技术风险
| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 数据源不稳定 | 中 | 高 | 多数据源fallback，缓存机制 |
| 策略效果不佳 | 中 | 高 | 充分回测，多策略并行 |
| 前端性能问题 | 低 | 中 | 懒加载，分页，虚拟滚动 |
| 定时任务冲突 | 低 | 中 | 任务锁，超时控制 |

### 进度风险
| 风险 | 应对措施 |
|------|---------|
| 某阶段延期 | 优先保证核心功能，次要功能可延后 |
| 需求变更 | 记录变更，评估影响，调整计划 |
| 技术难点 | 及时求助，查阅文档，简化方案 |

---

## 📝 下一步行动

### 立即开始（第一阶段）

1. **创建分支**
   ```bash
   git checkout -b feature/simulation-trading-stage1
   ```

2. **创建数据模型文件**
   ```bash
   touch src/schemas/simulation_models.py
   ```

3. **开始实现 Task 1.1**
   - 定义 `SimulationAccount` 数据类
   - 定义 `TradeLeg` 和 `PairedTrade`
   - 编写基础测试

4. **每日检查点**
   - Day 1: 完成数据模型 + 配对管理器50%
   - Day 2: 完成配对管理器 + T+1引擎
   - Day 3: 完成模拟服务 + 测试 + 文档

---

## 🎉 成功标准

### 功能完整性
- ✅ 能创建多个模拟账户
- ✅ 每日自动生成交易建议
- ✅ 能执行模拟交易
- ✅ 能查看复盘报告
- ✅ 自动推送日报/周报

### 性能指标
- ✅ API响应时间 < 1秒
- ✅ 页面加载时间 < 3秒
- ✅ 定时任务准时触发（误差<1分钟）

### 质量标准
- ✅ 单元测试覆盖率 > 70%
- ✅ 无严重bug
- ✅ 文档完整清晰
- ✅ 代码审查通过

### 用户体验
- ✅ 界面美观易用
- ✅ 操作反馈及时
- ✅ 错误提示友好
- ✅ 移动端可用

---

## 📞 支持与反馈

- 遇到问题先查文档
- 技术难题记录到 issue
- 每周回顾进度
- 及时调整计划

---

**最后更新**: 2026-05-16  
**维护者**: AI Assistant  
**版本**: v1.1（已根据专业审查优化）

---

## 🔧 优化说明（基于专业审查）

本计划已根据《潜在问题与优化建议.docx》中的8个关键问题进行优化：

### 1. 数据源依赖问题 ✅ 已解决
- **问题**: 策略算法强烈依赖实时/历史行情数据，后期切换真实数据时可能返工
- **解决**: 
  - 增加 `DataProvider` 抽象层，统一封装数据获取接口
  - 初期实现 `MockDataProvider` 和 `AkShareDataProvider`
  - 历史数据本地缓存（SQLite/Parquet），支持离线开发
  - 数据可用性检测，失败时自动降级或告警

### 2. 策略算法与回测脱节 ✅ 已解决
- **问题**: 策略算法没有明确说明如何与回测引擎衔接
- **解决**:
  - 定义统一的策略接口 `generate_signals(df)`
  - 第二阶段结束后立即引入简易回测脚本
  - 参数外置化（配置文件管理），便于回测优化

### 3. 配对交易管理器扩展性不足 ✅ 已解决
- **问题**: “一对一”匹配难以平滑扩展到“一对多”
- **解决**:
  - 采用订单簿模型（买单池、卖单池）
  - 价格时间优先撮合，自然支持多对多
  - 部分成交处理，记录剩余未成交数量
  - 明确强制平仓触发条件

### 4. 前端开发时间紧张 ✅ 已优化
- **问题**: 3-4天完成6个子任务过于紧张
- **解决**:
  - 分两轮交付：先核心功能（账户管理+建议查看+交易执行），后增强功能（报告展示+图表优化）
  - 复用 dsa-web 现有组件（表格、卡片、对话框）
  - 后端API先通过Postman验证，避免联调阻塞

### 5. 回测与自我进化过于理想化 ✅ 已简化
- **问题**: 3-4天完成参数自动优化、市场状态检测器、策略进化服务不现实
- **解决**:
  - 第一版只支持单策略、单参数的历史收益计算
  - 参数优化降级为手动设置，自动优化作为可选实验功能
  - 市场状态检测器使用简单的波动率分位数或趋势跟踪指标
  - 策略进化服务推迟到第二期，当前仅记录每日表现日志

### 6. 定时任务的可靠性风险 ✅ 已增强
- **问题**: schedule库是进程内调度，服务重启后错过的任务不会补执行
- **解决**:
  - 后台线程池执行，避免阻塞主事件循环
  - SQLite记录任务执行状态，服务启动时检查并补偿未执行的任务
  - 任务超时控制和失败重试机制
  - 通过通知系统告警

### 7. 账户与持仓的并发安全问题 ✅ 已解决
- **问题**: JSON文件持久化可能导致并发修改时数据不一致
- **解决**:
  - 迁移到SQLite数据库，利用行锁保证原子性
  - 服务层加线程锁（简单场景够用）
  - 版本号乐观锁（如需要）

### 8. 文档和交付物过多 ✅ 已优化
- **问题**: 第七阶段5个子任务2天完成偏紧
- **解决**:
  - 文档与开发同步：每个阶段完成后立即更新对应文档片段
  - API文档由FastAPI自动生成
  - 性能优化前置到各阶段（数据库索引第一阶段、API优化第三阶段、前端优化第四阶段）

### 优先级调整

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0（必须） | 数据抽象层、账户管理、配对交易、T+1引擎、API、前端核心功能、基础回测 | 核心功能，第一期必须完成 |
| P1（重要） | 市场状态检测器（简化版）、定时任务可靠性、并发安全 | 提升系统稳定性 |
| P2（可选） | 参数自动优化、策略进化服务、ML模型、高级图表 | 可推迟到第二期 |

### 修改后的时间线

总时间从原计划的 **21天** 调整为 **24天**，原因：
- ✅ 增加了数据抽象层、并发安全保障、任务可靠性机制
- ✅ 前端分两轮交付，降低单次压力
- ❌ 简化了自我进化功能，自动优化推迟到第二期
- ⚖️ 总体更稳健，减少后期返工风险
