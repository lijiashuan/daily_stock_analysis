# Git Push Script for daily_stock_analysis
# This script pushes changes to GitHub and Gitee via SSH

$ErrorActionPreference = "Stop"

Write-Host "=== Git Push Script ===" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location "D:\py2026\daily_stock_analysis"
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Check Git remote configuration
Write-Host "Checking Git remotes..." -ForegroundColor Yellow
git remote -v
Write-Host ""

# Add modified files
Write-Host "Adding changes..." -ForegroundColor Yellow
git add api/v1/endpoints/agent.py apps/dsa-web/src/api/agent.ts apps/dsa-web/src/pages/ChatPage.tsx static/assets/*
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to add files" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Files added successfully" -ForegroundColor Green
Write-Host ""

# Commit changes
Write-Host "Committing changes..." -ForegroundColor Yellow
$commitMsg = @"
feat: enhance single message export with multi-format support

- Add backend API endpoint for single message export
- Support MD, DOCX, PDF, HTML, RTF formats
- Fix RTF encoding issue by using ReportExportService
- Simplify frontend implementation to use backend API
- Ensure only selected message is exported, not entire session

Changes:
- api/v1/endpoints/agent.py: Add /export-message endpoint
- apps/dsa-web/src/api/agent.ts: Add exportChatMessage method
- apps/dsa-web/src/pages/ChatPage.tsx: Simplify export logic
- static/assets/*: Rebuild frontend bundle
"@

git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "No changes to commit or commit failed" -ForegroundColor Yellow
    exit 0
}
Write-Host "✓ Changes committed successfully" -ForegroundColor Green
Write-Host ""

# Push to GitHub via SSH
Write-Host "Pushing to GitHub (origin)..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to push to GitHub" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Pushed to GitHub successfully" -ForegroundColor Green
Write-Host ""

# Push to Gitee via SSH
Write-Host "Pushing to Gitee..." -ForegroundColor Yellow
git push gitee main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to push to Gitee" -ForegroundColor Yellow
} else {
    Write-Host "✓ Pushed to Gitee successfully" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== All done! ===" -ForegroundColor Cyan
Write-Host ""
