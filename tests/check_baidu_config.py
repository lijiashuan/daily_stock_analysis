#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查百度 OCR 配置
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import get_config

cfg = get_config()

print("=" * 60)
print("百度 OCR 配置检查")
print("=" * 60)

print(f"\nBAIDU_OCR_APP_ID: {cfg.baidu_ocr_app_id if cfg.baidu_ocr_app_id else '未配置'}")
print(f"BAIDU_OCR_API_KEY: {cfg.baidu_ocr_api_key[:20] + '...' if cfg.baidu_ocr_api_key else '未配置'}")
print(f"BAIDU_OCR_SECRET_KEY: {cfg.baidu_ocr_secret_key[:20] + '...' if cfg.baidu_ocr_secret_key else '未配置'}")

print("\n" + "=" * 60)
if cfg.baidu_ocr_app_id and cfg.baidu_ocr_api_key and cfg.baidu_ocr_secret_key:
    print("✓ 配置已加载")
else:
    print("✗ 配置不完整，请检查 .env 文件")
print("=" * 60)
