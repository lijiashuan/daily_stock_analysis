# PDF 导出配置说明

## 问题

WeasyPrint 在 Windows 上需要 GTK+ 库，安装比较复杂。

## 解决方案

我们提供了两种PDF生成方案，按优先级排序：

### 方案1：imgkit + wkhtmltopdf（推荐）✅

**优点：**
- 安装简单
- 对中文支持好
- 渲染效果佳

**安装步骤：**

1. **安装 Python 包**（已完成）：
   ```bash
   pip install imgkit
   ```

2. **下载并安装 wkhtmltopdf**：
   - 访问：https://wkhtmltopdf.org/downloads.html
   - 下载 Windows 版本（建议 0.12.6 或更高）
   - 运行安装程序
   - 记住安装路径（通常是 `C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe`）

3. **配置环境变量**（可选但推荐）：
   - 将 wkhtmltopdf 的 bin 目录添加到系统 PATH
   - 或者在代码中指定路径

4. **验证安装**：
   ```bash
   where wkhtmltopdf
   # 应该显示 wkhtmltopdf.exe 的路径
   ```

### 方案2：weasyprint（备选）⚠️

**缺点：**
- Windows 上需要安装 GTK+ 依赖
- 配置复杂

**如果必须使用 weasyprint：**

1. 安装 Python 包：
   ```bash
   pip install weasyprint
   ```

2. 安装 GTK3 for Windows：
   - 访问：https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
   - 下载最新的 GTK3 installer
   - 运行安装程序

3. 重启电脑后测试：
   ```bash
   python -c "import weasyprint; print('OK')"
   ```

## 当前状态

- ✅ imgkit 已安装
- ❌ wkhtmltopdf 未安装
- ⚠️ weasyprint 已安装但缺少 GTK+ 依赖

## 临时解决方案

在安装了 wkhtmltopdf 之前，您可以：

1. **使用其他格式**：
   - Markdown (.md) - 原始格式，易于编辑
   - Word (.docx) - 可编辑，兼容性好
   - HTML (.html) - 浏览器打开，效果好
   - RTF (.rtf) - 富文本格式

2. **手动转换为PDF**：
   - 导出为 HTML
   - 用浏览器打开
   - 使用浏览器的"打印为PDF"功能

## 快速安装 wkhtmltopdf

### Windows 用户

1. 下载安装包：
   ```
   https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox-0.12.6.1-2.msvc2015-win64.exe
   ```

2. 运行安装程序，默认安装到：
   ```
   C:\Program Files\wkhtmltopdf\
   ```

3. 添加到PATH（二选一）：

   **方法A：系统环境变量**
   - 右键"此电脑" → 属性 → 高级系统设置 → 环境变量
   - 在"系统变量"中找到 Path
   - 添加：`C:\Program Files\wkhtmltopdf\bin`

   **方法B：在代码中指定**（修改 report_export_service.py）
   ```python
   config = imgkit.config(wkhtmltopdf=r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe')
   imgkit.from_string(html_doc, str(filepath), options=options, config=config)
   ```

4. 验证：
   ```bash
   wkhtmltopdf --version
   ```

### macOS 用户

```bash
brew install wkhtmltopdf
```

### Linux 用户 (Ubuntu/Debian)

```bash
sudo apt-get install wkhtmltopdf
```

## 测试

安装完成后，运行测试脚本：

```bash
python test_pdf_rtf_fix.py <record_id>
```

例如：
```bash
python test_pdf_rtf_fix.py 123
```

## 常见问题

### Q: 为什么不用 weasyprint？

A: WeasyPrint 在 Windows 上需要完整的 GTK3 环境，大约需要下载 200MB+ 的依赖库，而且配置复杂。相比之下，wkhtmltopdf 是一个独立的可执行文件，安装简单得多。

### Q: 我可以同时安装两个吗？

A: 可以！代码会自动检测并使用可用的方案。优先使用 imgkit，如果不可用则尝试 weasyprint。

### Q: 不安装PDF生成库会影响其他功能吗？

A: 不会。只有PDF导出功能会受影响，其他格式（MD、DOCX、RTF、HTML）都可以正常使用。

## 总结

**推荐操作：**
1. 下载并安装 wkhtmltopdf（5分钟）
2. 添加到系统PATH
3. 重启服务器
4. 测试PDF导出

这样就可以完美支持PDF导出了！🎉
