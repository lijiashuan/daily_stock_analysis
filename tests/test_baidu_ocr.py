#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试百度智能云 OCR 图片识别功能
"""

import sys
import os
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import get_config

def test_baidu_ocr_config():
    """测试百度 OCR 配置是否正确加载"""
    cfg = get_config()
    
    print("=" * 60)
    print("百度智能云 OCR 配置检查")
    print("=" * 60)
    
    app_id = cfg.baidu_ocr_app_id
    api_key = cfg.baidu_ocr_api_key
    secret_key = cfg.baidu_ocr_secret_key
    
    if not app_id:
        print("❌ BAIDU_OCR_APP_ID 未配置")
        return False
    else:
        print(f"✓ BAIDU_OCR_APP_ID: {app_id[:10]}...（已配置）")
    
    if not api_key:
        print("❌ BAIDU_OCR_API_KEY 未配置")
        return False
    else:
        print(f"✓ BAIDU_OCR_API_KEY: {api_key[:15]}...（已配置）")
    
    if not secret_key:
        print("❌ BAIDU_OCR_SECRET_KEY 未配置")
        return False
    else:
        print(f"✓ BAIDU_OCR_SECRET_KEY: {secret_key[:15]}...（已配置）")
    
    print("\n✓ 所有配置项已设置，可以测试 OCR 功能")
    return True

def test_baidu_ocr_import():
    """测试百度 OCR SDK 是否可以导入"""
    try:
        from src.services.image_stock_extractor import BAIDU_AIP_AVAILABLE, AipOcr
        if BAIDU_AIP_AVAILABLE:
            print("✓ 百度智能云 SDK 已成功导入")
            return True
        else:
            print("❌ 百度智能云 SDK 未安装，请执行: pip install baidu-aip")
            return False
    except ImportError as e:
        print(f"❌ 导入百度智能云 SDK 失败: {e}")
        return False

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("百度智能云 OCR 功能测试")
    print("=" * 60 + "\n")
    
    # 测试配置
    config_ok = test_baidu_ocr_config()
    
    # 测试导入
    import_ok = test_baidu_ocr_import()
    
    print("\n" + "=" * 60)
    if config_ok and import_ok:
        print("✓ 测试通过！百度智能云 OCR 功能已就绪")
        print("\n下一步：")
        print("1. 访问 http://127.0.0.1:8000/chat")
        print("2. 上传股票截图测试图片识别功能")
    else:
        print("❌ 测试失败，请检查配置和依赖")
    print("=" * 60)
