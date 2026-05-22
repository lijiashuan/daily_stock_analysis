# -*- coding: utf-8 -*-
"""
===================================
Daily Stock Analysis - FastAPI 后端服务入口
===================================

职责：
1. 提供 RESTful API 服务
2. 配置 CORS 跨域支持
3. 健康检查接口
4. 托管前端静态文件（生产模式）

启动方式：
    uvicorn server:app --reload --host 0.0.0.0 --port 8000
    
    或使用 main.py:
    python main.py --serve-only      # 仅启动 API 服务
    python main.py --serve           # API 服务 + 执行分析
"""

import logging
import sqlite3
import os
from pathlib import Path

from src.config import setup_env, get_config
from src.logging_config import setup_logging


def run_database_migrations():
    """执行数据库迁移（幂等操作，可安全重复执行）"""
    logger = logging.getLogger(__name__)
    
    # 获取数据库路径
    db_path = Path(os.environ.get('DATABASE_PATH', 'data/stock_analysis.db'))
    
    if not db_path.exists():
        logger.info(f"Database not found at {db_path}, skipping migration")
        return
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # 检查并添加 sort_order 字段
        cursor.execute("PRAGMA table_info(conversation_session_meta)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'sort_order' not in columns:
            logger.info("Adding sort_order column to conversation_session_meta...")
            cursor.execute(
                "ALTER TABLE conversation_session_meta "
                "ADD COLUMN sort_order INTEGER"
            )
            conn.commit()
            logger.info("✓ Database migration completed successfully")
        else:
            logger.info("✓ sort_order column already exists, skipping migration")
        
        conn.close()
    except Exception as e:
        logger.error(f"Database migration failed: {e}")
        # 不阻塞服务启动，迁移失败不影响其他功能


# 初始化环境变量与日志
setup_env()

config = get_config()
level_name = (config.log_level or "INFO").upper()
level = getattr(logging, level_name, logging.INFO)

setup_logging(
    log_prefix="api_server",
    console_level=level,
    extra_quiet_loggers=['uvicorn', 'fastapi'],
)

# 执行数据库迁移
run_database_migrations()

# 从 api.app 导入应用实例
from api.app import app  # noqa: E402

# 导出 app 供 uvicorn 使用
__all__ = ['app']


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
