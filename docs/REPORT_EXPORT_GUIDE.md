# 报告导出功能说明

## 概述

股票分析系统现在支持将分析报告导出为多种格式，包括：
- **Markdown (.md)** - 原始Markdown格式
- **PDF (.pdf)** - 便携式文档格式
- **Word (.docx)** - Microsoft Word文档
- **HTML (.html)** - 网页格式
- **RTF (.rtf)** - 富文本格式

## 使用方法

### 前端界面导出

1. 在首页或历史记录页面，点击任意股票分析报告
2. 点击"完整分析报告"按钮打开Markdown预览
3. 点击右上角的下载图标（⬇️）
4. 从下拉菜单中选择需要的格式：
   - 📄 Markdown (.md)
   - 📕 PDF (.pdf)
   - 📘 Word (.docx)
   - 🌐 HTML (.html)
   - 📝 RTF (.rtf)

### API接口导出

#### 统一导出接口

```
GET /api/v1/history/{record_id}/export?format={format}
```

**参数：**
- `record_id`: 分析历史记录ID（整数）或 query_id（字符串）
- `format`: 导出格式，可选值：`md`, `pdf`, `docx`, `html`, `rtf`

**示例：**
```bash
# 导出为PDF
curl -O "http://localhost:8000/api/v1/history/123/export?format=pdf"

# 导出为Word
curl -O "http://localhost:8000/api/v1/history/123/export?format=docx"

# 导出为HTML
curl -O "http://localhost:8000/api/v1/history/123/export?format=html"
```

#### 原有Markdown接口（仍可用）

```
GET /api/v1/history/{record_id}/markdown
```

返回JSON格式的Markdown内容。

### 后端直接调用

```python
from src.services.report_export_service import ReportExportService

# 导出为PDF
pdf_path = ReportExportService.export_to_pdf(markdown_content)

# 导出为Word
docx_path = ReportExportService.export_to_docx(markdown_content)

# 导出为RTF
rtf_path = ReportExportService.export_to_rtf(markdown_content)

# 导出为HTML
html_path = ReportExportService.export_to_html(markdown_content)
```

## 依赖安装

### PDF导出依赖

PDF导出需要安装 `weasyprint` 库：

```bash
pip install weasyprint
```

**Windows用户注意：**
WeasyPrint需要一些系统级依赖，请参考 [WeasyPrint官方文档](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows) 进行安装。

简化安装步骤：
1. 安装 GTK3: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
2. 运行: `pip install weasyprint`

**macOS用户：**
```bash
brew install pango glib gdk-pixbuf libffi
pip install weasyprint
```

**Linux用户（Ubuntu/Debian）：**
```bash
sudo apt-get install build-essential python3-dev python3-pip python3-setuptools python3-wheel python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
pip install weasyprint
```

### 其他格式依赖

其他格式的依赖已包含在 `requirements.txt` 中：

```bash
pip install -r requirements.txt
```

主要包括：
- `python-docx>=0.8.11` - Word文档生成
- `markdown2>=2.4.0` - Markdown转HTML
- `pygments>=2.15.0` - 代码高亮

## 测试功能

提供了测试脚本来验证所有导出格式：

```bash
# 测试所有格式（脚本已归档）
python scripts/archive/test_export_formats.py <record_id> all

# 仅测试PDF
python scripts/archive/test_export_formats.py <record_id> pdf

# 仅测试Word
python scripts/archive/test_export_formats.py <record_id> docx
```

示例：
```bash
python scripts/archive/test_export_formats.py 123 all
```

导出的文件会保存在 `reports/` 目录下。

## 文件格式特性

### Markdown (.md)
- ✅ 保留原始格式
- ✅ 适合二次编辑
- ✅ 文件大小小
- ❌ 需要Markdown阅读器

### PDF (.pdf)
- ✅ 跨平台一致显示
- ✅ 适合打印和分享
- ✅ 保留完整样式
- ❌ 不易编辑

### Word (.docx)
- ✅ 可编辑
- ✅ 广泛兼容
- ✅ 支持Office套件
- ⚠️ 复杂格式可能有偏差

### HTML (.html)
- ✅ 浏览器直接打开
- ✅ 支持交互元素
- ✅ 易于分享
- ⚠️ 需要网络连接（如有外部资源）

### RTF (.rtf)
- ✅ 跨平台兼容
- ✅ 支持基本格式
- ✅ 文件大小适中
- ⚠️ 不支持高级特性

## 常见问题

### Q: PDF导出失败？
A: 请确保已安装weasyprint及其系统依赖。运行 `pip install weasyprint` 并检查系统依赖是否完整。

### Q: 导出的文件名是什么？
A: 文件名格式为 `{股票名称}_{股票代码}_report.{格式}`，例如：`贵州茅台_600519_report.pdf`

### Q: 可以自定义导出路径吗？
A: 目前导出文件保存在 `reports/` 目录下。如需自定义，可以修改 `ReportExportService` 中的路径配置。

### Q: 导出速度慢？
A: PDF导出相对较慢，因为需要进行排版渲染。其他格式通常很快（<1秒）。

### Q: 表格和图表能正确导出吗？
A: 
- Markdown表格：✅ 所有格式都支持
- 图片：⚠️ 当前版本主要支持文本，图片支持有限
- 代码块：✅ 支持语法高亮（HTML/PDF）

## 技术实现

### 后端架构

```
HistoryService (获取Markdown内容)
    ↓
ReportExportService (格式转换)
    ├── export_to_pdf()    → WeasyPrint
    ├── export_to_docx()   → python-docx
    ├── export_to_rtf()    → 原生RTF生成
    └── export_to_html()   → markdown2
    ↓
FastAPI FileResponse (文件下载)
```

### 前端架构

```
ReportMarkdown组件
    ↓
historyApi.exportReport() (调用后端API)
    ↓
Blob对象创建
    ↓
浏览器下载
```

## 更新日志

### 2026-05-09
- ✅ 新增PDF导出支持
- ✅ 新增统一导出API接口
- ✅ 前端添加多格式导出下拉菜单
- ✅ 添加国际化支持
- ✅ 提供测试脚本

## 未来计划

- [ ] 支持批量导出
- [ ] 添加图片/图表导出支持
- [ ] 支持自定义模板
- [ ] 添加导出进度显示
- [ ] 支持更多格式（Excel, PowerPoint等）

## 贡献

如有问题或建议，请提交Issue或Pull Request。
