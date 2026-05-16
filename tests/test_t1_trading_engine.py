# -*- coding: utf-8 -*-
"""
T+1 Trading Engine Unit Tests
"""

import sys
sys.path.insert(0, '.')

from datetime import date, timedelta
from src.strategies.t1_trading_engine import T1TradingEngine


def test_t1_basic_buy_sell():
    """Test basic T+1 buy and sell"""
    print("\n" + "="*60)
    print("Test 1: Basic T+1 Buy/Sell")
    print("="*60)
    
    engine = T1TradingEngine()
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    # Buy today (not available yet)
    engine.add_buy_position('600519', 100, 100.0, today)
    
    assert engine.get_total_position('600519') == 100
    assert engine.get_available_quantity('600519') == 0
    assert not engine.can_sell('600519', 100)
    
    print("[OK] Buy position created, not available for T+0")
    
    # Process day end (next day)
    tomorrow = today + timedelta(days=1)
    engine.process_day_end(tomorrow)
    
    assert engine.get_available_quantity('600519') == 100
    assert engine.can_sell('600519', 100)
    
    print("[OK] Position available after T+1")
    
    # Sell
    result = engine.execute_sell('600519', 100, 105.0, tomorrow)
    
    assert result['success'] == True
    assert result['profit'] == 500.0  # (105 - 100) * 100
    
    print(f"[OK] Sell executed, profit: {result['profit']:.2f}")


def test_t1_insufficient_position():
    """Test selling more than available"""
    print("\n" + "="*60)
    print("Test 2: Insufficient Position")
    print("="*60)
    
    engine = T1TradingEngine()
    today = date.today()
    tomorrow = today + timedelta(days=1)
    
    # Buy 100 shares
    engine.add_buy_position('600519', 100, 100.0, today)
    engine.process_day_end(tomorrow)
    
    # Try to sell 150 (more than available)
    result = engine.execute_sell('600519', 150, 105.0, tomorrow)
    
    assert result['success'] == False
    assert 'Insufficient' in result['message']
    
    print("[OK] Correctly rejected insufficient position")


def test_t1_multiple_lots():
    """Test multiple position lots with FIFO"""
    print("\n" + "="*60)
    print("Test 3: Multiple Lots (FIFO)")
    print("="*60)
    
    engine = T1TradingEngine()
    day1 = date.today() - timedelta(days=2)
    day2 = date.today() - timedelta(days=1)
    today = date.today()
    
    # Buy on day1
    engine.add_buy_position('600519', 100, 100.0, day1)
    # Buy on day2
    engine.add_buy_position('600519', 100, 102.0, day2)
    
    engine.process_day_end(today)
    
    # Both should be available
    assert engine.get_available_quantity('600519') == 200
    
    # Sell 150 (should use FIFO: 100 from day1 @ 100, 50 from day2 @ 102)
    result = engine.execute_sell('600519', 150, 105.0, today)
    
    assert result['success'] == True
    # Profit: (105-100)*100 + (105-102)*50 = 500 + 150 = 650
    assert abs(result['profit'] - 650.0) < 0.01
    
    print(f"[OK] FIFO sell executed, profit: {result['profit']:.2f}")
    
    # Check remaining position
    summary = engine.get_position_summary()
    assert summary['600519']['total_quantity'] == 50
    assert summary['600519']['available_quantity'] == 50
    
    print("[OK] Remaining position correct")


def test_t1_position_summary():
    """Test position summary reporting"""
    print("\n" + "="*60)
    print("Test 4: Position Summary")
    print("="*60)
    
    engine = T1TradingEngine()
    today = date.today()
    
    # Add positions
    engine.add_buy_position('600519', 100, 100.0, today)
    engine.add_buy_position('000001', 200, 50.0, today)
    
    summary = engine.get_position_summary()
    
    assert '600519' in summary
    assert summary['600519']['total_quantity'] == 100
    assert summary['600519']['available_quantity'] == 0  # Not available yet (T+0)
    assert summary['600519']['frozen_quantity'] == 100
    
    assert '000001' in summary
    assert summary['000001']['total_quantity'] == 200
    
    print("[OK] Position summary correct")
    print(f"  600519: total={summary['600519']['total_quantity']}, "
          f"available={summary['600519']['available_quantity']}")
    print(f"  000001: total={summary['000001']['total_quantity']}, "
          f"available={summary['000001']['available_quantity']}")


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("T+1 Trading Engine - Unit Tests")
    print("="*60)
    
    try:
        test_t1_basic_buy_sell()
        test_t1_insufficient_position()
        test_t1_multiple_lots()
        test_t1_position_summary()
        
        print("\n" + "="*60)
        print("[OK] All T+1 tests passed!")
        print("="*60)
        return 0
        
    except AssertionError as e:
        print(f"\n[FAIL] Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit(main())
