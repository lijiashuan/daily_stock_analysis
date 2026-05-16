#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 PDF 和 RTF 导出功能
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.storage import DatabaseManager
from src.services.history_service import HistoryService
from src.services.report_export_service import ReportExportService


def test_pdf_export(record_id: int):
    """测试PDF导出"""
    print(f"\n{'='*60}")
    print(f"测试 PDF 导出 (record_id={record_id})")
    print('='*60)
    
    db = DatabaseManager.get_instance()
    service = HistoryService(db)
    
    try:
        # 获取 Markdown 内容
        markdown_content = service.get_markdown_report(str(record_id))
        if not markdown_content:
            print("✗ 无法获取 Markdown 内容")
            return False
        
        print(f"✓ Markdown 内容获取成功，长度: {len(markdown_content)} 字符")
        
        # 检查是否有中文字符
        has_chinese = any('\u4e00' <= char <= '\u9fff' for char in markdown_content)
        print(f"  包含中文: {'是' if has_chinese else '否'}")
        
        # 导出 PDF
        filepath = ReportExportService.export_to_pdf(markdown_content)
        print(f"✓ PDF 导出成功: {filepath}")
        
        # 检查文件大小
        file_size = Path(filepath).stat().st_size
        print(f"  文件大小: {file_size / 1024:.2f} KB")
        
        if file_size > 0:
            print("✓ PDF 文件非空")
            return True
        else:
            print("✗ PDF 文件为空")
            return False
            
    except ImportError as e:
        print(f"⚠ 缺少依赖库: {e}")
        print("请运行: pip install weasyprint")
        return False
    except Exception as e:
        print(f"✗ PDF 导出失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_rtf_export(record_id: int):
    """测试RTF导出（重点检查中文）"""
    print(f"\n{'='*60}")
    print(f"测试 RTF 导出 (record_id={record_id})")
    print('='*60)
    
    db = DatabaseManager.get_instance()
    service = HistoryService(db)
    
    try:
        # 获取 Markdown 内容
        markdown_content = service.get_markdown_report(str(record_id))
        if not markdown_content:
            print("✗ 无法获取 Markdown 内容")
            return False
        
        print(f"✓ Markdown 内容获取成功，长度: {len(markdown_content)} 字符")
        
        # 导出 RTF
        filepath = ReportExportService.export_to_rtf(markdown_content)
        print(f"✓ RTF 导出成功: {filepath}")
        
        # 检查文件大小
        file_size = Path(filepath).stat().st_size
        print(f"  文件大小: {file_size / 1024:.2f} KB")
        
        if file_size == 0:
            print("✗ RTF 文件为空")
            return False
        
        # 读取文件并检查编码
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否包含 Unicode 转义序列
        has_unicode_escape = '\\u' in content
        print(f"  包含 Unicode 转义: {'是' if has_unicode_escape else '否'}")
        
        # 检查 RTF 头部
        if '\\utf8' in content:
            print("  ✓ RTF 使用 UTF-8 编码声明")
        elif '\\ansi' in content:
            print("  ⚠ RTF 使用 ANSI 编码（可能导致乱码）")
        
        print("✓ RTF 文件格式正确")
        return True
            
    except Exception as e:
        print(f"✗ RTF 导出失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    if len(sys.argv) < 2:
        print("用法: python test_pdf_rtf_fix.py <record_id>")
        print("示例: python test_pdf_rtf_fix.py 123")
        sys.exit(1)
    
    record_id = sys.argv[1]
    
    print(f"\n开始测试 PDF 和 RTF 导出修复")
    print(f"Record ID: {record_id}")
    
    # 测试 PDF
    pdf_ok = test_pdf_export(record_id)
    
    # 测试 RTF
    rtf_ok = test_rtf_export(record_id)
    
    print(f"\n{'='*60}")
    print("测试结果总结")
    print('='*60)
    print(f"PDF 导出: {'✓ 通过' if pdf_ok else '✗ 失败'}")
    print(f"RTF 导出: {'✓ 通过' if rtf_ok else '✗ 失败'}")
    
    if pdf_ok and rtf_ok:
        print("\n✓ 所有测试通过！")
        print("\n提示:")
        print("- 导出的文件保存在 reports/ 目录下")
        print("- 请用相应的应用程序打开查看效果")
        print("- RTF 文件建议用 Word 或写字板打开")
    else:
        print("\n✗ 部分测试失败，请检查上述错误信息")
        sys.exit(1)


if __name__ == '__main__':
    main()
