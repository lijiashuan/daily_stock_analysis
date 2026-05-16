# Git 推送说明

## 问题
当前终端会话被一个未完成的 PowerShell 多行输入阻塞，无法直接执行 Git 命令。

## 解决方案

请在新打开的 PowerShell 或 CMD 窗口中执行以下命令：

### 方法 1: 使用 Python 脚本（推荐）

```powershell
cd D:\py2026\daily_stock_analysis
python git_push_helper.py
```

这个脚本会自动：
1. 添加修改的文件
2. 提交更改
3. 推送到 GitHub (origin)
4. 推送到 Gitee

### 方法 2: 手动执行 Git 命令

```powershell
# 切换到项目目录
cd D:\py2026\daily_stock_analysis

# 添加修改的文件
git add api/v1/endpoints/agent.py apps/dsa-web/src/api/agent.ts apps/dsa-web/src/pages/ChatPage.tsx static/assets/*

# 提交更改
git commit -m "feat: enhance single message export with multi-format support

- Add backend API endpoint for single message export
- Support MD, DOCX, PDF, HTML, RTF formats
- Fix RTF encoding issue by using ReportExportService
- Simplify frontend implementation to use backend API
- Ensure only selected message is exported, not entire session

Changes:
- api/v1/endpoints/agent.py: Add /export-message endpoint
- apps/dsa-web/src/api/agent.ts: Add exportChatMessage method
- apps/dsa-web/src/pages/ChatPage.tsx: Simplify export logic
- static/assets/*: Rebuild frontend bundle"

# 推送到 GitHub
git push origin main

# 推送到 Gitee
git push gitee main
```

### 方法 3: 使用批处理文件

双击运行项目根目录下的 `push_changes.bat` 文件。

## 本次修改内容

### 新增功能
- 单条消息多格式导出（MD、DOCX、PDF、HTML、RTF）
- 后端新增 API 端点：`GET /api/v1/agent/chat/sessions/{session_id}/export-message`
- 所有格式都只导出选中的单条消息，而非整个会话

### 修复问题
- RTF 文件中文乱码问题（通过使用 ReportExportService 解决）
- PDF 导出需要手动保存的问题（现在自动下载）
- DOCX 格式兼容性问题

### 代码优化
- 前端代码从 150+ 行简化到 30 行
- 统一使用后端 ReportExportService 处理所有格式
- 提高代码可维护性

## 修改的文件列表

1. `api/v1/endpoints/agent.py` - 新增单条消息导出 API
2. `apps/dsa-web/src/api/agent.ts` - 新增 exportChatMessage 方法
3. `apps/dsa-web/src/pages/ChatPage.tsx` - 简化导出逻辑
4. `static/assets/*` - 前端构建产物（已更新）

## 验证

推送完成后，可以访问以下地址验证：
- GitHub: https://github.com/[your-username]/daily_stock_analysis
- Gitee: https://gitee.com/[your-username]/daily_stock_analysis
