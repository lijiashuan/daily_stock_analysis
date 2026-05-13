# Chat 页面多格式导出功能实现说明

## 概述

为 `/chat` 问股页面添加了多格式导出功能，支持将聊天会话导出为多种格式。

## 功能特性

### 1. 导出格式支持

目前支持以下格式（通过下拉菜单选择）：
- 📄 **Markdown (.md)** - ✅ 完整支持（后端生成）
- 📕 **PDF (.pdf)** - ✅ 完整支持（后端 WeasyPrint 生成）
- 📘 **Word (.docx)** - ✅ 完整支持（后端 python-docx 生成）
- 🌐 **HTML (.html)** - ✅ 完整支持（后端 markdown2 生成）
- 📝 **RTF (.rtf)** - ✅ 完整支持（后端原生 RTF 生成）

所有格式都通过后端 API `/api/v1/agent/chat/sessions/{session_id}/export` 实现，确保真正的多格式导出。

### 2. 智能文件命名

文件名格式：**`问股_股票名称_日期_时间.格式`**

例如：
- `问股_贵州茅台_20260512_1530.md`
- `问股_20260512_1530.md`（未检测到股票名称时）

### 3. 股票名称自动提取

系统会自动从聊天内容中提取股票名称，支持以下模式：
- "分析 贵州茅台" → 提取 "贵州茅台"
- "茅台怎么样" → 提取 "茅台"
- "腾讯股票" → 提取 "腾讯"

如果无法自动提取，则使用不带股票名称的格式。

## 修改的文件

### 1. `apps/dsa-web/src/utils/chatExport.ts`

**新增功能**：
- `extractStockNameFromMessages()` - 从消息中提取股票名称
- `generateChatFilename()` - 生成符合规范的文件名
- `downloadSessionInFormat()` - 按指定格式导出的主函数

**修改功能**：
- `downloadSession()` - 支持传入股票名称参数，并自动提取

### 2. `apps/dsa-web/src/pages/ChatPage.tsx`

**UI 改进**：
- 将原来的单个"导出会话"按钮改为带下拉菜单的导出组件
- 鼠标悬停时显示 5 种格式选项
- 保持与历史报告导出界面的一致性

**代码变更**：
- 导入 `downloadSessionInFormat` 函数
- 替换原有的简单导出按钮为带下拉菜单的组件

## 使用方法

1. 访问 `http://127.0.0.1:8000/chat`
2. 进行股票分析对话
3. 点击右上角的 **"导出会话"** 按钮
4. 在下拉菜单中选择需要的格式
5. 文件将自动下载，文件名包含股票名称（如能识别）和时间戳

## 技术实现细节

### 后端 API

**端点**: `GET /api/v1/agent/chat/sessions/{session_id}/export`

**参数**:
- `session_id`: 聊天会话 ID
- `format`: 导出格式 (md, docx, rtf, html, pdf)

**实现流程**:
1. 从数据库获取会话消息
2. 将消息格式化为 Markdown
3. 调用 `ReportExportService` 进行格式转换
4. 返回文件响应

### 前端集成

**API 调用** (`apps/dsa-web/src/api/agent.ts`):
```typescript
exportChatSession: async (sessionId, format) => {
  const response = await apiClient.get(
    `/api/v1/agent/chat/sessions/${sessionId}/export`,
    { params: { format }, responseType: 'blob' }
  );
  return response.data;
}
```

**导出函数** (`apps/dsa-web/src/utils/chatExport.ts`):
```typescript
export async function downloadSessionInFormat(
  messages, format, stockName, sessionId
) {
  if (sessionId) {
    // Use backend API for proper format conversion
    const blob = await agentApi.exportChatSession(sessionId, format);
    // Trigger download with proper filename
  }
}
```

### 股票名称提取算法

```typescript
function extractStockNameFromMessages(messages: Message[]): string | undefined {
  // 遍历用户消息
  // 使用正则表达式匹配常见模式
  const patterns = [
    /分析\s+([\u4e00-\u9fa5]{2,10})/,  // 分析 贵州茅台
    /([\u4e00-\u9fa5]{2,10})\s*怎么样/,
    /([\u4e00-\u9fa5]{2,10})\s*股票/,
  ];
  // 返回第一个匹配的股票名称
}
```

### 文件名生成

```typescript
function generateChatFilename(stockName?: string): string {
  const dateStr = YYYYMMDD 格式
  const timeStr = HHmm 格式
  
  if (stockName) {
    return `问股_${stockName}_${dateStr}_${timeStr}`;
  }
  return `问股_${dateStr}_${timeStr}`;
}
```

## 与历史报告导出的对比

| 特性 | Chat 页面导出 | 历史报告导出 |
|------|--------------|-------------|
| 位置 | `/chat` 页面右上角 | 报告详情页右上角 |
| MD 格式 | ✅ 完整支持 | ✅ 完整支持 |
| PDF/DOCX/HTML/RTF | ✅ 完整支持（后端生成） | ✅ 完整支持（后端生成） |
| 文件命名 | 问股_股票名称_日期_时间 | 股票名称_股票代码_report |
| 股票名称提取 | 自动从对话提取 | 从数据库获取 |
| 实现方式 | 后端 API | 后端 API |
| 共用服务 | ReportExportService | ReportExportService |

## 未来改进方向

1. **更智能的股票识别**：结合股票代码和名称的映射关系
2. **批量导出**：支持导出多个会话
3. **自定义模板**：允许用户自定义导出内容的格式
4. **图片支持**：如果对话中包含图表，支持导出图片
5. **导出历史记录**：保存导出历史，方便再次下载

## 测试建议

1. 测试不同股票的对话导出
2. 测试无法识别股票名称的情况
3. 测试长对话的导出性能
4. 验证文件名的正确性
5. 检查下拉菜单的交互体验

## 注意事项

- 所有格式都通过后端 API 实现，确保真正的多格式导出
- 股票名称提取基于简单的正则匹配，可能不适用于所有情况
- 文件名中的时间使用本地时间（小时和分钟）
- PDF 导出需要安装 WeasyPrint 及其系统依赖
- 如果后端导出失败，会降级为客户端 Markdown 导出

---

**实现日期**：2026-05-12  
**相关 Issue**：用户反馈缺少多格式导出功能
