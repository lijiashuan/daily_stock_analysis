#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Test cash ledger CSV parsing."""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.services.portfolio_import_service import PortfolioImportService

def test_cash_ledger_parsing():
    """Test parsing cash ledger CSV file."""
    csv_path = Path(r"C:\Users\jys\Desktop\study\华泰\cash_ledger_export_all_to_all.csv")
    
    if not csv_path.exists():
        print(f"❌ File not found: {csv_path}")
        return
    
    # Read file content
    content = csv_path.read_bytes()
    print(f"📄 File size: {len(content)} bytes")
    
    # Parse with importer
    importer = PortfolioImportService()
    
    try:
        result = importer.parse_cash_ledger_csv(
            broker="huatai",
            content=content,
            filename=csv_path.name
        )
        
        print(f"\n✅ Parse Result:")
        print(f"   Broker: {result['broker']}")
        print(f"   Records: {result['record_count']}")
        print(f"   Skipped: {result['skipped_count']}")
        print(f"   Errors: {result['error_count']}")
        
        if result.get('skip_reasons'):
            print(f"\n⚠️  Skip Reasons:")
            for reason, count in result['skip_reasons'].items():
                print(f"   - {reason}: {count}")
        
        if result.get('errors'):
            print(f"\n❌ Errors (first 5):")
            for error in result['errors'][:5]:
                print(f"   - {error}")
        
        if result.get('records'):
            print(f"\n📋 Sample Records (first 3):")
            for i, record in enumerate(result['records'][:3]):
                print(f"   [{i+1}] {record}")
    
    except Exception as e:
        print(f"\n❌ Parse failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_cash_ledger_parsing()
