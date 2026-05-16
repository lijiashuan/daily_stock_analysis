#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试报告导出功能

用法:
    python test_export_formats.py <record_id> [format]
    
示例:
    python test_export_formats.py 123 md
    python test_export_formats.py 123 pdf
    python test_export_formats.py 123 docx
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.storage import DatabaseManager
from src.services.history_service import HistoryService
from src.services.report_export_service import ReportExportService


def test_markdown_export(record_id: int):
    """测试Markdown导出"""
    print(f"\n{'='*60}")
    print(f"测试 Markdown 导出 (record_id={record_id})")
    print('='*60)
    
    db = DatabaseManager.get_instance()
    service = HistoryService(db)
    
    try:
        markdown_content = service.get_markdown_report(str(record_id))
        if markdown_content:
            print(f"✓ Markdown 内容生成成功，长度: {len(markdown_content)} 字符")
            print(f"前100字符: {markdown_content[:100]}...")
            return markdown_content
        else:
            print("✗ Markdown 内容为空")
            return None
    except Exception as e:
        print(f"✗ Markdown 导出失败: {e}")
        return None


def test_pdf_export(markdown_content: str):
    """测试PDF导出"""
    print(f"\n{'='*60}")
    print("测试 PDF 导出")
    print('='*60)
    
    try:
        filepath = ReportExportService.export_to_pdf(markdown_content)
        print(f"✓ PDF 导出成功: {filepath}")
        return True
    except ImportError as e:
        print(f"⚠ 缺少依赖库: {e}")
        print("请运行: pip install weasyprint")
        return False
    except Exception as e:
        print(f"✗ PDF 导出失败: {e}")
        return False


def test_docx_export(markdown_content: str):
    """测试Word导出"""
    print(f"\n{'='*60}")
    print("测试 Word (.docx) 导出")
    print('='*60)
    
    try:
        filepath = ReportExportService.export_to_docx(markdown_content)
        print(f"✓ Word 导出成功: {filepath}")
        return True
    except Exception as e:
        print(f"✗ Word 导出失败: {e}")
        return False


def test_rtf_export(markdown_content: str):
    """测试RTF导出"""
    print(f"\n{'='*60}")
    print("测试 RTF 导出")
    print('='*60)
    
    try:
        filepath = ReportExportService.export_to_rtf(markdown_content)
        print(f"✓ RTF 导出成功: {filepath}")
        return True
    except Exception as e:
        print(f"✗ RTF 导出失败: {e}")
        return False


def test_html_export(markdown_content: str):
    """测试HTML导出"""
    print(f"\n{'='*60}")
    print("测试 HTML 导出")
    print('='*60)
    
    try:
        filepath = ReportExportService.export_to_html(markdown_content)
        print(f"✓ HTML 导出成功: {filepath}")
        return True
    except Exception as e:
        print(f"✗ HTML 导出失败: {e}")
        return False


def main():
    if len(sys.argv) < 2:
        print("用法: python test_export_formats.py <record_id> [format]")
        print("示例:")
        print("  python test_export_formats.py 123 md      # 仅测试 Markdown")
        print("  python test_export_formats.py 123 pdf     # 测试所有格式")
        print("  python test_export_formats.py 123 all     # 测试所有格式")
        sys.exit(1)
    
    record_id = sys.argv[1]
    test_format = sys.argv[2] if len(sys.argv) > 2 else 'all'
    
    print(f"\n开始测试报告导出功能")
    print(f"Record ID: {record_id}")
    print(f"测试格式: {test_format}")
    
    # 首先测试 Markdown 导出
    markdown_content = test_markdown_export(record_id)
    
    if not markdown_content:
        print("\n✗ Markdown 导出失败，无法继续测试其他格式")
        sys.exit(1)
    
    # 根据参数测试其他格式
    if test_format in ['all', 'pdf']:
        test_pdf_export(markdown_content)
    
    if test_format in ['all', 'docx']:
        test_docx_export(markdown_content)
    
    if test_format in ['all', 'rtf']:
        test_rtf_export(markdown_content)
    
    if test_format in ['all', 'html']:
        test_html_export(markdown_content)
    
    print(f"\n{'='*60}")
    print("测试完成！")
    print('='*60)
    print("\n提示:")
    print("- 导出的文件保存在 reports/ 目录下")
    print("- 如果某些格式测试失败，请检查是否安装了对应的依赖库")
    print("- PDF 导出需要安装 weasyprint: pip install weasyprint")


if __name__ == '__main__':
    main()
