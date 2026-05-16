# -*- coding: utf-8 -*-
"""
数据库迁移脚本：为 portfolio_accounts 表增加 account_type 字段

执行方式：
    python scripts/migrate_add_account_type.py

注意事项：
1. 执行前请备份数据库
2. 现有账户会自动设置为 account_type='real'
3. 迁移是幂等的，可以重复执行
"""

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.storage import DatabaseManager
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """执行数据库迁移"""
    db = DatabaseManager.get_instance()
    
    logger.info("开始执行数据库迁移：增加 account_type 字段")
    
    with db.get_session() as session:
        # 1. 检查字段是否已存在
        result = session.execute(text("""
            PRAGMA table_info(portfolio_accounts)
        """))
        columns = [row[1] for row in result.fetchall()]
        
        if 'account_type' in columns:
            logger.info("✅ account_type 字段已存在，跳过迁移")
            return
        
        logger.info("📝 准备添加 account_type 字段...")
        
        # 2. 添加字段（SQLite 不支持直接添加带默认值的字段，需要分步）
        try:
            # SQLite ALTER TABLE 只能添加 nullable 字段
            session.execute(text("""
                ALTER TABLE portfolio_accounts 
                ADD COLUMN account_type TEXT
            """))
            logger.info("✅ 成功添加 account_type 字段（nullable）")
            
        except Exception as e:
            logger.error(f"❌ 添加字段失败: {e}")
            session.rollback()
            raise
        
        # 3. 更新现有记录为 'real'
        try:
            result = session.execute(text("""
                UPDATE portfolio_accounts 
                SET account_type = 'real' 
                WHERE account_type IS NULL
            """))
            updated_count = result.rowcount
            session.commit()
            logger.info(f"✅ 已更新 {updated_count} 条现有记录的 account_type='real'")
            
        except Exception as e:
            logger.error(f"❌ 更新现有记录失败: {e}")
            session.rollback()
            raise
        
        # 4. 验证迁移结果
        try:
            result = session.execute(text("""
                SELECT COUNT(*) FROM portfolio_accounts WHERE account_type IS NULL
            """))
            null_count = result.scalar()
            
            if null_count > 0:
                logger.warning(f"⚠️ 仍有 {null_count} 条记录的 account_type 为 NULL")
            else:
                logger.info("✅ 所有记录的 account_type 都已正确设置")
                
            # 检查字段是否存在
            result = session.execute(text("""
                PRAGMA table_info(portfolio_accounts)
            """))
            columns = [row[1] for row in result.fetchall()]
            
            if 'account_type' in columns:
                logger.info("✅ 迁移验证通过：account_type 字段存在")
            else:
                logger.error("❌ 迁移验证失败：account_type 字段不存在")
                raise Exception("Migration verification failed")
                
        except Exception as e:
            logger.error(f"❌ 验证失败: {e}")
            raise
    
    logger.info("🎉 数据库迁移完成！")
    logger.info("💡 提示：新创建的账户可以通过指定 account_type 来区分实盘/模拟")


if __name__ == "__main__":
    try:
        migrate()
        print("\n✅ 迁移成功完成！")
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
