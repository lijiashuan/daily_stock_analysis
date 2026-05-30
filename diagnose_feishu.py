# -*- coding: utf-8 -*-
"""
飞书自动分析功能诊断脚本
用于排查飞书功能无法正常工作的问题
"""

import os
import sys
import logging
from pathlib import Path

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment_config():
    """检查环境变量配置"""
    print("=" * 60)
    print("1. 检查环境变量配置")
    print("=" * 60)
    
    # 加载.env文件
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"已加载环境变量文件: {env_path}")
    else:
        print(f"警告: 环境变量文件不存在: {env_path}")
        return False
    
    required_vars = {
        'FEISHU_APP_ID': '飞书应用ID',
        'FEISHU_APP_SECRET': '飞书应用密钥',
        'FEISHU_STREAM_ENABLED': '飞书Stream模式启用状态',
        'AGENT_MODE': 'AI代理模式',
        'AGENT_NL_ROUTING': '自然语言路由'
    }
    
    all_ok = True
    for var, desc in required_vars.items():
        value = os.getenv(var)
        if value:
            print(f"✓ {desc} ({var}): {value[:20]}{'...' if len(value) > 20 else ''}")
        else:
            print(f"✗ {desc} ({var}): 未配置")
            all_ok = False
    
    return all_ok

def check_database_tables():
    """检查数据库表是否创建"""
    print("\n" + "=" * 60)
    print("2. 检查数据库表")
    print("=" * 60)
    
    try:
        from src.storage import get_db, Base
        from src.tags_manager import Tag, TagAssignment
        
        db = get_db()
        
        # 检查tags表
        try:
            with db.get_session() as session:
                session.query(Tag).first()
            print("✓ tags 表存在且可访问")
            tags_ok = True
        except Exception as e:
            print(f"✗ tags 表不存在或无法访问: {e}")
            tags_ok = False
        
        # 检查tag_assignments表
        try:
            with db.get_session() as session:
                session.query(TagAssignment).first()
            print("✓ tag_assignments 表存在且可访问")
            assignments_ok = True
        except Exception as e:
            print(f"✗ tag_assignments 表不存在或无法访问: {e}")
            assignments_ok = False
        
        return tags_ok and assignments_ok
        
    except Exception as e:
        print(f"✗ 数据库检查失败: {e}")
        return False

def check_feishu_stream_handler():
    """检查飞书Stream处理器"""
    print("\n" + "=" * 60)
    print("3. 检查飞书Stream处理器")
    print("=" * 60)
    
    try:
        from bot.platforms.feishu_stream import (
            FeishuStreamHandler,
            get_feishu_stream_handler,
            FEISHU_SDK_AVAILABLE
        )
        
        print(f"✓ 飞书SDK可用: {FEISHU_SDK_AVAILABLE}")
        
        handler = get_feishu_stream_handler()
        if handler:
            print("✓ 飞书Stream处理器已创建")
            print(f"✓ 处理器启用状态: {handler.is_enabled()}")
            return True
        else:
            print("✗ 飞书Stream处理器未创建")
            return False
            
    except Exception as e:
        print(f"✗ 飞书Stream处理器检查失败: {e}")
        return False

def check_tag_handler():
    """检查标签处理器"""
    print("\n" + "=" * 60)
    print("4. 检查标签处理器")
    print("=" * 60)
    
    try:
        from bot.handlers.feishu_tag_handler import (
            FeishuTagHandler,
            get_feishu_tag_handler
        )
        
        handler = get_feishu_tag_handler()
        if handler:
            print("✓ 飞书标签处理器已创建")
            print(f"✓ 标签名称: {handler.tag_name}")
            return True
        else:
            print("✗ 飞书标签处理器未创建")
            return False
            
    except Exception as e:
        print(f"✗ 飞书标签处理器检查失败: {e}")
        return False

def check_dispatcher():
    """检查调度器配置"""
    print("\n" + "=" * 60)
    print("5. 检查调度器配置")
    print("=" * 60)
    
    try:
        from bot.dispatcher import CommandDispatcher
        from src.config import get_config
        
        config = get_config()
        
        agent_mode = getattr(config, 'agent_mode', False)
        nl_routing = getattr(config, 'agent_nl_routing', False)
        
        print(f"✓ AI代理模式: {agent_mode}")
        print(f"✓ 自然语言路由: {nl_routing}")
        
        if agent_mode and nl_routing:
            print("✓ 调度器配置正确")
            return True
        else:
            print("✗ 调度器配置不完整")
            print("  请确保 AGENT_MODE=true 和 AGENT_NL_ROUTING=true")
            return False
            
    except Exception as e:
        print(f"✗ 调度器检查失败: {e}")
        return False

def check_auto_analyze_command():
    """检查自动分析命令"""
    print("\n" + "=" * 60)
    print("6. 检查自动分析命令")
    print("=" * 60)
    
    try:
        from bot.commands.auto_analyze import AutoAnalyzeCommand
        
        cmd = AutoAnalyzeCommand()
        print(f"✓ 自动分析命令存在")
        print(f"✓ 命令名称: {cmd.name}")
        print(f"✓ 命令描述: {cmd.description}")
        print(f"✓ 命令是否隐藏: {cmd.hidden}")
        return True
        
    except Exception as e:
        print(f"✗ 自动分析命令检查失败: {e}")
        return False

def test_tag_system():
    """测试标签系统"""
    print("\n" + "=" * 60)
    print("7. 测试标签系统")
    print("=" * 60)
    
    try:
        from src.tags_manager import get_tags_manager
        
        manager = get_tags_manager()
        
        # 测试创建标签
        tag = manager.get_or_create_tag("测试标签", "用于诊断测试")
        print(f"✓ 标签创建/获取成功: {tag.name}")
        
        # 测试分配标签
        success = manager.assign_tag_to_message(
            tag_name="测试标签",
            message_id="test_msg_001",
            platform="test",
            description="测试消息"
        )
        print(f"✓ 标签分配成功: {success}")
        
        return True
        
    except Exception as e:
        print(f"✗ 标签系统测试失败: {e}")
        return False

def create_missing_tables():
    """创建缺失的数据库表"""
    print("\n" + "=" * 60)
    print("8. 创建缺失的数据库表")
    print("=" * 60)
    
    try:
        from src.storage import DatabaseManager, Base
        from src.tags_manager import Tag, TagAssignment
        
        db = DatabaseManager.get_instance()
        
        # 创建所有表
        Base.metadata.create_all(db._engine)
        print("✓ 数据库表创建完成")
        
        return True
        
    except Exception as e:
        print(f"✗ 数据库表创建失败: {e}")
        return False

def main():
    """主函数"""
    print("飞书自动分析功能诊断")
    print("=" * 60)
    
    # 检查环境配置
    env_ok = check_environment_config()
    
    # 检查数据库表
    db_ok = check_database_tables()
    
    # 如果数据库表不存在，尝试创建
    if not db_ok:
        print("\n尝试创建缺失的数据库表...")
        create_missing_tables()
        db_ok = check_database_tables()
    
    # 检查飞书Stream处理器
    stream_ok = check_feishu_stream_handler()
    
    # 检查标签处理器
    tag_ok = check_tag_handler()
    
    # 检查调度器
    dispatcher_ok = check_dispatcher()
    
    # 检查自动分析命令
    command_ok = check_auto_analyze_command()
    
    # 测试标签系统
    tag_system_ok = test_tag_system()
    
    # 总结
    print("\n" + "=" * 60)
    print("诊断总结")
    print("=" * 60)
    
    results = {
        "环境变量配置": env_ok,
        "数据库表": db_ok,
        "飞书Stream处理器": stream_ok,
        "标签处理器": tag_ok,
        "调度器配置": dispatcher_ok,
        "自动分析命令": command_ok,
        "标签系统": tag_system_ok
    }
    
    for item, status in results.items():
        status_str = "✓ 正常" if status else "✗ 异常"
        print(f"{item}: {status_str}")
    
    all_ok = all(results.values())
    
    if all_ok:
        print("\n✅ 所有检查通过！飞书自动分析功能应该可以正常工作。")
        print("请启动应用并测试：python main.py --serve-only")
    else:
        print("\n⚠️ 发现问题，请根据上述检查结果进行修复。")
        print("常见问题解决方案：")
        print("1. 确保环境变量正确配置")
        print("2. 确保飞书应用已发布且有正确权限")
        print("3. 确保数据库表已创建")
        print("4. 确保飞书SDK已安装: pip install lark-oapi")
    
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())