@echo off
chcp 65001 >nul
echo ========================================
echo 启动飞书Webhook服务器
echo ========================================
echo.

python run_feishu_webhook.py

pause