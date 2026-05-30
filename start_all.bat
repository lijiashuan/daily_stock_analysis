@echo off
echo 启动A股自选股智能分析系统...
start cmd /k python main.py --webui-only
timeout /t 5 /nobreak >nul
start cmd /k python start_feishu_stream.py
echo 服务已启动!