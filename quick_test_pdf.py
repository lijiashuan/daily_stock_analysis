#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
快速测试 PDF 导出功能
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.storage import DatabaseManager
from src.services.history_service import HistoryService
from src.services.report_export_service import ReportExportService


def test_pdf_with_imgkit(record_id: int):
    """测试使用 imgkit 导出 PDF"""
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
        print("\n正在导出 PDF...")
        filepath = ReportExportService.export_to_pdf(markdown_content)
        print(f"✓ PDF 导出成功: {filepath}")
        
        # 检查文件大小
        file_size = Path(filepath).stat().st_size
        print(f"  文件大小: {file_size / 1024:.2f} KB")
        
        if file_size > 1000:  # 至少 1KB
            print("✓ PDF 文件正常")
            print(f"\n📄 文件位置: {filepath}")
            print(f"\n提示: 可以用 PDF 阅读器打开查看效果")
            return True
        else:
            print("✗ PDF 文件太小，可能有问题")
            return False
            
    except ImportError as e:
        print(f"⚠ 缺少依赖库: {e}")
        print("\n请安装:")
        print("  pip install imgkit")
        print("  并下载 wkhtmltopdf: https://wkhtmltopdf.org/")
        return False
    except Exception as e:
        print(f"✗ PDF 导出失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    if len(sys.argv) < 2:
        print("用法: python quick_test_pdf.py <record_id>")
        print("示例: python quick_test_pdf.py 123")
        print("\n提示: 先运行以下命令查看可用的 record_id:")
        print("  python -c \"from src.storage import DatabaseManager; from src.services.history_service import HistoryService; db=DatabaseManager.get_instance(); svc=HistoryService(db); records=svc.list_records(limit=5); [print(f'{r.id}: {r.name} ({r.code})') for r in records]\"")
        sys.exit(1)
    
    record_id = sys.argv[1]
    
    print(f"\n开始测试 PDF 导出功能")
    print(f"Record ID: {record_id}")
    
    # 测试 PDF
    pdf_ok = test_pdf_with_imgkit(record_id)
    
    if pdf_ok:
        print("\n✅ PDF 导出功能正常工作！")
        print("\n您现在可以:")
        print("1. 在前端界面选择 PDF 格式导出")
        print("2. 或通过 API: GET /api/v1/history/{id}/export?format=pdf")
    else:
        print("\n❌ PDF 导出失败，请检查上述错误信息")
        sys.exit(1)


if __name__ == '__main__':
    main()
