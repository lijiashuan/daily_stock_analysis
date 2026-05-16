@echo off
cd /d D:\py2026\daily_stock_analysis

echo Adding changes...
git add api/v1/endpoints/agent.py apps/dsa-web/src/api/agent.ts apps/dsa-web/src/pages/ChatPage.tsx static/assets/*

echo Committing changes...
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

echo Pushing to GitHub...
git push origin main

echo Pushing to Gitee...
git push gitee main

echo Done!
pause
