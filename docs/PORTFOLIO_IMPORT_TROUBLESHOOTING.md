# 券商导入问题诊断指南

## 🔍 问题：所有行都被跳过

**症状：**
```
CSV 解析结果
有效 0 条，跳过 169 条，错误 0 条。
```

这意味着文件被成功读取和解析，但是**没有任何一行数据符合必需字段的验证规则**。

---

## 📋 诊断步骤

### 步骤 1：查看日志中的列名信息

重启服务后重新上传文件，查看日志输出：

```
Parsed DataFrame columns: ['列名1', '列名2', ...]
DataFrame shape: (169, 8)
First row sample: {'列名1': '值1', '列名2': '值2', ...}
Skip reasons summary: {'missing_trade_date_column': 169}
```

**关键信息：**
- `columns`: 文件中实际的列名
- `shape`: 行数和列数
- `First row sample`: 第一行数据的示例
- `Skip reasons`: 每行被跳过的原因统计

### 步骤 2：检查必需的列名

系统需要以下**5个必需字段**：

| 必需字段 | 支持的列名（中文） | 支持的列名（英文） |
|---------|------------------|------------------|
| **成交日期** | 成交日期、发生日期、日期、成交时间 | trade_date, date |
| **证券代码** | 证券代码、股票代码、代码 | symbol, code, stock_code |
| **买卖方向** | 买卖标志、买卖方向、交易方向、业务名称、操作 | side, direction |
| **成交价格** | 成交均价、成交价格、价格、成交价、均价 | price, avg_price |
| **成交数量** | 成交数量、数量、成交股数 | quantity, qty, shares |

**如果列名不匹配，系统无法识别数据！**

### 步骤 3：检查跳过原因

根据 `skip_reasons` 中的信息判断问题：

#### 原因 1: `missing_trade_date_column`
**问题**: 找不到成交日期列

**解决**:
- 检查列名是否包含"日期"或"date"
- 确保日期格式正确（如 2024-01-01）

#### 原因 2: `invalid_trade_date: xxx`
**问题**: 日期格式无法解析

**解决**:
- 确保日期格式为：YYYY-MM-DD、YYYY/MM/DD、YYYYMMDD
- 避免使用"2024年1月1日"等中文格式

#### 原因 3: `missing_symbol_column`
**问题**: 找不到证券代码列

**解决**:
- 检查列名是否包含"代码"、"证券"、"股票"或"code"、"symbol"
- 确保股票代码是6位数字（A股）或其他有效格式

#### 原因 4: `invalid_symbol: xxx`
**问题**: 股票代码格式不正确

**解决**:
- A股：6位数字（如 600519）
- 港股：hk + 5位数字（如 hk00700）
- 美股：字母代码（如 AAPL）

#### 原因 5: `missing_side_column`
**问题**: 找不到买卖方向列

**解决**:
- 检查列名是否包含"买卖"、"方向"、"操作"或"side"
- 确保值是"买入"/"卖出"或"buy"/"sell"

#### 原因 6: `invalid_side: xxx`
**问题**: 买卖方向无法识别

**支持的值**:
- ✅ 买入、买、B、buy
- ✅ 卖出、卖、S、sell
- ❌ 其他值（如"申购"、"赎回"等不被支持）

#### 原因 7: `missing_quantity_column` 或 `invalid_quantity: xxx`
**问题**: 成交数量缺失或无效

**解决**:
- 确保数量是正数
- 避免空值、0、负数
- 检查列名是否包含"数量"、"股数"或"quantity"

#### 原因 8: `missing_price_column` 或 `invalid_price: xxx`
**问题**: 成交价格缺失或无效

**解决**:
- 确保价格是正数
- 避免空值、0、负数
- 检查列名是否包含"价格"、"成交价"或"price"

---

## 🛠️ 常见解决方案

### 方案 1：列名不匹配

**问题示例：**
```
实际列名: ['交易时间', '证券编号', '方向', '单价', '手数']
期望列名: ['成交日期', '证券代码', '买卖方向', '成交价格', '成交数量']
```

**解决方法：**

**方法 A：在 Excel 中重命名列**
1. 用 Excel 打开文件
2. 修改第一行的列名为标准名称
3. 保存后重新上传

**方法 B：添加列名映射**
编辑 `src/services/portfolio_import_service.py`，在 `DEFAULT_PARSER_SPECS` 中添加新的列名映射：

```python
CsvParserSpec(
    broker="huatai",
    aliases=(),
    display_name="华泰",
    column_hints={
        "trade_date": ("成交日期", "发生日期", "日期", "成交时间", "交易时间"),  # 新增
        "symbol": ("证券代码", "股票代码", "代码", "证券编号"),  # 新增
        "side": ("买卖标志", "买卖方向", "操作", "方向"),  # 新增
        "quantity": ("成交数量", "数量", "成交股数", "手数"),  # 新增
        "price": ("成交均价", "成交价格", "价格", "成交价", "单价"),  # 新增
        "trade_uid": ("成交编号", "成交序号", "流水号"),
    },
),
```

### 方案 2：日期格式不正确

**问题示例：**
```
日期列内容: "2024年01月01日" 或 "Jan 1, 2024"
```

**解决方法：**

在 Excel 中统一日期格式：
1. 选中日期列
2. 右键 → 设置单元格格式
3. 选择"日期" → 格式 "2024-01-01"
4. 保存后重新上传

### 方案 3：买卖方向值不标准

**问题示例：**
```
方向列内容: "证券买入"、"普通卖出"、"申购"、"赎回"
```

**解决方法：**

**方法 A：替换为标准值**
在 Excel 中使用查找替换：
- "证券买入" → "买入"
- "普通卖出" → "卖出"
- "申购" → "买入"（如果是买入操作）
- "赎回" → "卖出"（如果是卖出操作）

**方法 B：扩展支持的值**
编辑 `_normalize_side` 方法，添加新的映射：

```python
@staticmethod
def _normalize_side(value: Any) -> Optional[str]:
    text = str(value or "").strip().lower()
    if not text:
        return None
    compact = text.replace(" ", "")
    buy_exact = {"buy", "b", "买", "买入", "证券买入", "普通买入", "申购"}  # 新增
    sell_exact = {"sell", "s", "卖", "卖出", "证券卖出", "普通卖出", "赎回"}  # 新增
    if compact in buy_exact:
        return "buy"
    if compact in sell_exact:
        return "sell"
    if "买入" in compact or compact.startswith("买") or "申购" in compact:  # 新增
        return "buy"
    if "卖出" in compact or compact.startswith("卖") or "赎回" in compact:  # 新增
        return "sell"
    return None
```

### 方案 4：数据包含特殊字符

**问题示例：**
```
价格列: "1,800.00" 或 "¥1800.00"
数量列: "100股" 或 "100 shares"
```

**解决方法：**

在 Excel 中清理数据：
1. 删除货币符号（¥、$、€）
2. 删除单位（股、shares）
3. 删除千分位分隔符（逗号）
4. 只保留纯数字

或使用公式清理：
```excel
=SUBSTITUTE(SUBSTITUTE(A2, "¥", ""), ",", "")
```

### 方案 5：文件包含非数据行

**问题示例：**
```
第1行: "华泰证券交易记录"
第2行: "导出时间：2024-01-01"
第3行: （空行）
第4行: 证券代码  成交日期  ...  ← 真正的表头
第5行: 600519   2024-01-01 ...  ← 真正的数据
```

**解决方法：**

1. 删除文件开头和结尾的非数据行
2. 确保第一行是列名（表头）
3. 从第二行开始是数据
4. 删除所有空行

---

## 📝 快速修复模板

### 标准 CSV/TXT 格式模板

创建文件 `template.csv`：

```csv
证券代码,成交日期,买卖方向,成交价格,成交数量,手续费,印花税
600519,2024-01-01,买入,1800.00,100,5.00,0.00
600520,2024-01-02,卖出,1850.00,50,5.00,9.25
000001,2024-01-03,买入,12.50,1000,3.00,0.00
```

### 标准 TSV 格式模板

创建文件 `template.txt`（使用 TAB 分隔）：

```txt
证券代码	成交日期	买卖方向	成交价格	成交数量	手续费	印花税
600519	2024-01-01	买入	1800.00	100	5.00	0.00
600520	2024-01-02	卖出	1850.00	50	5.00	9.25
000001	2024-01-03	买入	12.50	1000	3.00	0.00
```

---

## 🔧 调试技巧

### 技巧 1：查看原始数据

在浏览器开发者工具中查看 API 响应：

```javascript
// 在控制台运行
fetch('/api/v1/portfolio/imports/csv/parse', {
  method: 'POST',
  body: formData
})
.then(r => r.json())
.then(data => console.log('Skip reasons:', data.skip_reasons));
```

### 技巧 2：手动测试解析

创建测试脚本 `test_parse.py`：

```python
from src.services.portfolio_import_service import PortfolioImportService

# 读取文件
with open('your_file.txt', 'rb') as f:
    content = f.read()

# 解析
service = PortfolioImportService()
result = service.parse_trade_csv(
    broker='huatai',
    content=content,
    filename='your_file.txt'
)

print(f"有效记录: {result['record_count']}")
print(f"跳过记录: {result['skipped_count']}")
print(f"跳过原因: {result['skip_reasons']}")
print(f"错误信息: {result['errors']}")
```

### 技巧 3：检查编码问题

```python
# 检测文件编码
import chardet

with open('your_file.txt', 'rb') as f:
    raw = f.read(10000)
    result = chardet.detect(raw)
    print(f"编码: {result['encoding']}")
    print(f"置信度: {result['confidence']}")
```

---

## 📞 获取帮助

如果以上方法都无法解决问题，请提供以下信息：

1. **文件前3行**（脱敏后）
   ```
   列名1,列名2,列名3,...
   值1,值2,值3,...
   值4,值5,值6,...
   ```

2. **完整的 skip_reasons**
   ```json
   {
     "missing_trade_date_column": 169
   }
   ```

3. **日志中的列名信息**
   ```
   Parsed DataFrame columns: [...]
   First row sample: {...}
   ```

4. **券商名称和导出方式**
   - 哪个券商？
   - 从 APP 还是网站导出？
   - 导出时选择了什么格式？

---

**最后更新**: 2026-05-13  
**版本**: v1.0
