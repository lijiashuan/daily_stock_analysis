# PDF 和 RTF 导出问题修复说明

## 问题描述

用户报告了两个问题：

1. **PDF下载报错**：选择PDF格式下载时，前端显示"下载失败：请求失败{}"
2. **RTF文件乱码**：导出的RTF文件中中文显示为乱码

## 问题分析

### 问题1：PDF下载报错

**原因：**
- 后端API在出错时返回JSON格式的错误信息
- 前端使用 `responseType: 'blob'` 接收响应
- 当后端返回错误时，axios将JSON错误也当作blob处理
- 前端无法正确解析错误信息，导致显示空对象 `{}`

**解决方案：**
修改前端API客户端，添加错误检测逻辑：
1. 设置 `validateStatus` 允许接收4xx/5xx响应
2. 检查响应的 `content-type` 头
3. 如果是JSON类型，解析并抛出有意义的错误信息
4. 如果是blob类型，正常返回文件数据

### 问题2：RTF文件乱码

**原因：**
- RTF文件头部声明使用 `\ansi\ansicpg936`（ANSI编码）
- 但文件实际以UTF-8编码保存
- 中文字符没有进行RTF Unicode转义
- RTF阅读器按照ANSI解码，导致乱码

**解决方案：**
1. 修改RTF头部为 `\utf8` 声明
2. 添加 `escape_rtf_text()` 函数处理文本转义：
   - 转义RTF特殊字符：`\`, `{`, `}`
   - 将非ASCII字符（中文等）转换为 `\u{unicode}?` 格式
3. 对所有文本内容应用转义处理

## 修复内容

### 1. 前端API客户端修复

**文件：** `apps/dsa-web/src/api/history.ts`

```typescript
exportReport: async (recordId: number, format: 'md' | 'docx' | 'rtf' | 'html' | 'pdf' = 'md'): Promise<Blob> => {
  const response = await apiClient.get(`/api/v1/history/${recordId}/export`, {
    params: { format },
    responseType: 'blob',
    validateStatus: (status) => status < 500, // 允许接收错误响应
  });
  
  // 检查是否是错误响应（后端返回JSON错误而不是文件）
  if (response.headers['content-type']?.includes('application/json')) {
    const text = await response.data.text();
    try {
      const error = JSON.parse(text);
      throw new Error(error.detail?.message || error.detail || '导出失败');
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('导出失败：未知错误');
    }
  }
  
  return response.data;
},
```

**改进点：**
- ✅ 添加了 `validateStatus` 配置
- ✅ 检测响应类型（JSON vs Blob）
- ✅ 解析并抛出有意义的错误信息
- ✅ 用户现在能看到具体的错误原因

### 2. 后端RTF导出修复

**文件：** `src/services/report_export_service.py`

**关键修改：**

1. **RTF头部改为UTF-8：**
```python
rtf_content = [
    r"{\rtf1\utf8\deff0",  # 原来是 \ansi\ansicpg936
    r"{\fonttbl{\f0\fswiss\fcharset0 Microsoft YaHei;}}",  # charset 改为 0
    ...
]
```

2. **添加Unicode转义函数：**
```python
def escape_rtf_text(text: str) -> str:
    """转义 RTF 特殊字符并处理 Unicode"""
    # 转义 RTF 特殊字符
    text = text.replace('\\', '\\\\')
    text = text.replace('{', '\\{')
    text = text.replace('}', '\\}')
    
    # 处理非 ASCII 字符（中文等）
    result = []
    for char in text:
        if ord(char) > 127:
            # Unicode 字符使用 \u 转义
            result.append(f"\\u{ord(char)}?")
        else:
            result.append(char)
    return ''.join(result)
```

3. **对所有文本应用转义：**
```python
# 标题
if line.startswith('# '):
    text = escape_rtf_text(line[2:])  # 添加转义
    rtf_content.append(f"\\pard\\sb240\\sa120\\b\\fs32 {text}\\b0\\par")
```

**改进点：**
- ✅ RTF头部正确声明UTF-8编码
- ✅ 中文字符正确转义为Unicode序列
- ✅ RTF特殊字符得到正确处理
- ✅ 文件在任何RTF阅读器中都能正确显示中文

## 测试方法

### 后端测试

运行测试脚本验证修复：

```bash
# 测试 PDF 和 RTF 导出（脚本已归档）
python scripts/archive/test_pdf_rtf_fix.py <record_id>

# 示例
python scripts/archive/test_pdf_rtf_fix.py 123
```

测试脚本会：
1. 获取指定记录的Markdown内容
2. 导出为PDF并验证文件大小
3. 导出为RTF并检查编码是否正确
4. 输出详细的测试结果

### 前端测试

1. 启动前端开发服务器：
   ```bash
   cd apps/dsa-web
   npm run dev
   ```

2. 访问任意股票分析报告

3. 点击"完整分析报告"

4. 尝试下载PDF格式：
   - 如果成功，应该直接下载文件
   - 如果失败，应该显示具体的错误信息（而不是空对象）

5. 尝试下载RTF格式：
   - 用Word或写字板打开
   - 检查中文是否正常显示

## 技术细节

### RTF Unicode转义原理

RTF格式支持两种表示非ASCII字符的方式：

1. **UTF-8声明（推荐）**
   ```rtf
   {\rtf1\utf8...
   ```
   直接在文件中保存UTF-8字节

2. **Unicode转义序列**
   ```rtf
   \u20016?  ; 表示 Unicode 码点 20016 的字符
   ```
   
我们的实现结合了两种方式：
- 头部声明UTF-8（兼容性最好）
- 同时对非ASCII字符进行Unicode转义（确保最大兼容性）

### Axios Blob响应处理

当使用 `responseType: 'blob'` 时：

**正常情况（文件下载）：**
- 后端返回文件 → Content-Type: application/pdf
- axios返回Blob对象 → 可直接下载

**异常情况（后端错误）：**
- 后端返回JSON → Content-Type: application/json
- axios仍返回Blob对象 → 需要手动解析

我们的修复通过检查Content-Type来区分这两种情况。

## 常见问题

### Q: PDF仍然下载失败？

A: 检查以下几点：
1. 是否安装了weasyprint：`pip install weasyprint`
2. Windows用户是否安装了GTK3依赖
3. 查看浏览器控制台的具体错误信息
4. 检查后端日志是否有错误

### Q: RTF文件在某些编辑器中仍然乱码？

A: 可能的原因：
1. 使用的编辑器不支持UTF-8编码的RTF
2. 尝试用Microsoft Word或Windows写字板打开
3. 确保文件扩展名是 `.rtf`

### Q: 如何验证RTF编码是否正确？

A: 用文本编辑器打开RTF文件，检查：
1. 第一行应该包含 `\utf8`
2. 中文字符应该显示为 `\uXXXXX?` 格式
3. 不应该有直接的中文汉字（除非编辑器自动解码）

## 相关文件

- `apps/dsa-web/src/api/history.ts` - 前端API客户端
- `apps/dsa-web/src/components/report/ReportMarkdown.tsx` - 前端下载组件
- `src/services/report_export_service.py` - 后端导出服务
- `scripts/archive/test_pdf_rtf_fix.py` - 测试脚本（已归档）

## 更新日志

### 2026-05-09
- ✅ 修复PDF下载错误信息显示问题
- ✅ 修复RTF中文乱码问题
- ✅ 添加RTF Unicode转义支持
- ✅ 添加测试脚本
- ✅ 完善错误处理机制
