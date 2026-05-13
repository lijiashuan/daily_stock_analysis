# 券商 HTML 表格格式支持 - 技术说明

## 🎯 问题背景

许多中国券商（如华泰证券、中信证券等）导出的"Excel"文件实际上是 **HTML 表格**，而非真正的 Excel 二进制格式。这些文件通常：

- 扩展名为 `.xls`
- 实际内容是 HTML `<table>` 标签
- 可以用 Excel 打开（因为 Excel 能解析 HTML）
- 但无法用标准的 Excel 读取库（openpyxl/xlrd）直接解析

### 典型错误

```
Excel file format cannot be determined, you must specify an engine manually.
```

## 🔍 技术实现

### 1. 格式检测

通过检查文件头的"魔术字节"来识别真实格式：

```python
def _detect_excel_format(content: bytes) -> str:
    # XLSX (ZIP): starts with PK
    if content[:2] == b'PK':
        return 'xlsx'
    
    # XLS (OLE2): starts with D0 CF 11 E0
    if content[:4] == b'\xD0\xCF\x11\xE0':
        return 'xls'
    
    # HTML table: contains <table> or <html> tags
    text_start = content[:2048].decode('utf-8', errors='ignore').lower()
    if '<table' in text_start or '<html' in text_start:
        return 'html'
    
    return None
```

### 2. HTML 表格解析

使用 pandas 的 `read_html()` 函数解析 HTML 表格：

```python
def _read_html_table(content: bytes) -> pd.DataFrame:
    # 尝试多种编码
    for encoding in ('utf-8', 'gbk', 'gb18030'):
        try:
            html_text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    
    # 解析所有 <table> 标签
    tables = pd.read_html(StringIO(html_text), dtype=str, keep_default_na=False)
    
    # 返回第一个表格
    return tables[0]
```

### 3. 智能降级策略

系统按以下顺序尝试解析：

```
用户上传文件
    ↓
检测文件格式
    ↓
┌──────────────┐
│ 是 HTML?     │
└──┬───────────┘
   │ Yes         No
   ↓             ↓
解析HTML表    是 XLSX?
               │ Yes     No
               ↓         ↓
          openpyxl    是 XLS?
                       │ Yes     No
                       ↓         ↓
                      xlrd    尝试所有引擎
                               ↓
                          都失败？
                          │ Yes     No
                          ↓         ↓
                    尝试HTML表   成功返回
                          ↓
                     最终报错
```

## 📦 依赖要求

### 必需库

```txt
pandas>=2.0.0       # 核心数据处理
lxml>=4.9.0         # HTML/XML 解析器
html5lib>=1.1       # HTML5 解析器（备用）
openpyxl>=3.1.0     # .xlsx 读取
xlrd>=2.0.0         # .xls 读取
```

### 安装命令

```bash
pip install pandas lxml html5lib openpyxl xlrd
```

## 🧪 测试示例

### 示例 1：华泰证券 HTML 表格

```python
from src.services.portfolio_import_service import PortfolioImportService

# 读取文件
with open('20260513_历史成交.xls', 'rb') as f:
    content = f.read()

# 自动检测并解析
service = PortfolioImportService()
result = service.parse_trade_csv(
    broker='huatai',
    content=content,
    filename='20260513_历史成交.xls'
)

print(f"解析成功：{result['record_count']} 条记录")
```

### 示例 2：手动检测格式

```python
from src.services.portfolio_import_service import PortfolioImportService

with open('trades.xls', 'rb') as f:
    content = f.read()

detected = PortfolioImportService._detect_excel_format(content)
print(f"检测到格式：{detected}")  # 输出: html
```

## 🎨 支持的 HTML 表格格式

### 标准 HTML 表格

```html
<table>
  <tr>
    <th>证券代码</th>
    <th>成交日期</th>
    <th>买卖方向</th>
    <th>成交价格</th>
    <th>成交数量</th>
  </tr>
  <tr>
    <td>600519</td>
    <td>2024-01-01</td>
    <td>买入</td>
    <td>1800.00</td>
    <td>100</td>
  </tr>
</table>
```

### 带样式的表格

```html
<table style="border-collapse: collapse;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th>证券代码</th>
      <th>成交日期</th>
      <!-- ... -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>600519</td>
      <td>2024-01-01</td>
      <!-- ... -->
    </tr>
  </tbody>
</table>
```

### 多表格 HTML

如果文件中包含多个表格，系统会：
1. 解析所有 `<table>` 标签
2. 使用**第一个表格**作为数据源
3. 忽略其他表格

## ⚠️ 注意事项

### 1. 编码问题

HTML 文件可能使用不同编码：
- UTF-8（最常见）
- GBK（中文 Windows）
- GB18030（简体中文）

系统会自动尝试多种编码。

### 2. 表格结构

- ✅ 支持带表头 (`<th>`) 的表格
- ✅ 支持无表头的表格（使用列索引）
- ✅ 支持合并单元格（部分支持）
- ❌ 不支持嵌套表格

### 3. 性能考虑

- HTML 解析比真正的 Excel 稍慢
- 大文件（>10MB）可能需要更多时间
- 建议清理不必要的工作表和样式

## 🔧 故障排查

### 问题 1：找不到表格

**错误**: `No tables found in HTML`

**原因**: 
- 文件不是 HTML 格式
- HTML 结构损坏
- 使用了非标准的表格标签

**解决**:
1. 用浏览器打开文件，确认是 HTML 表格
2. 用 Excel 另存为真正的 .xlsx 格式
3. 检查 HTML 是否包含完整的 `<table>` 标签

### 问题 2：缺少依赖

**错误**: `无法解析HTML表格：需要安装 lxml 或 html5lib`

**解决**:
```bash
pip install lxml html5lib
```

### 问题 3：编码错误

**错误**: 乱码或解析失败

**解决**:
1. 用文本编辑器打开文件，查看声明的编码
2. 确保文件保存为 UTF-8 或 GBK
3. 在 Excel 中重新保存

## 📊 与其他格式的对比

| 特性 | 真正 Excel | HTML 表格 | CSV |
|------|-----------|----------|-----|
| 文件大小 | 中等 | 较大 | 最小 |
| 解析速度 | 快 | 中等 | 最快 |
| 格式保留 | ✅ 完整 | ⚠️ 部分 | ❌ 无 |
| 兼容性 | ✅ 好 | ✅ 最好 | ✅ 最好 |
| 多工作表 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 券商导出 | ⚠️ 较少 | ✅ 常见 | ✅ 常见 |

## 🚀 未来优化

可能的改进方向：

1. **更好的错误提示**
   - 显示检测到的表格数量
   - 提示哪个表格被使用
   - 给出列名映射建议

2. **多表格支持**
   - 让用户选择使用哪个表格
   - 自动合并多个表格

3. **智能列名匹配**
   - 基于内容推测列含义
   - 支持更多语言的列名

4. **缓存机制**
   - 缓存已解析的文件
   - 加速重复导入

---

**最后更新**: 2026-05-13  
**版本**: v1.0  
**作者**: AI Assistant
