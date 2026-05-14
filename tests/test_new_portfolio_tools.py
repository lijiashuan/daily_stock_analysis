#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script for new portfolio tools: get_current_positions and get_account_recent_trades
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.agent.tools.data_tools import (
    _handle_get_current_positions,
    _handle_get_account_recent_trades,
)


def test_get_current_positions():
    """Test getting current positions with today's trades."""
    print("=" * 80)
    print("Testing get_current_positions...")
    print("=" * 80)
    
    # Test without account_id (all accounts)
    result = _handle_get_current_positions(
        account_id=None,
        cost_method="fifo",
        include_today_trades=True
    )
    
    if result.get("status") == "ok":
        print(f"\n✅ Status: OK")
        print(f"📅 As of: {result.get('as_of')}")
        summary = result.get('snapshot_summary', {})
        print(f"💰 Total Equity: {summary.get('total_equity', 'N/A')}")
        print(f"📊 Position Count: {result.get('position_count', 0)}")
        print(f"📝 Today's Trade Count: {result.get('today_trade_count', 0)}")
        
        # Show positions
        positions = result.get('positions', [])
        if positions:
            print(f"\n{'='*80}")
            print(f"{'Positions Summary':^80}")
            print(f"{'='*80}")
            print(f"{'Symbol':<12} {'Qty':>10} {'Avg Cost':>12} {'Last Price':>12} {'Price Src':<15} {'Price Date':<12}")
            print(f"{'-'*80}")
            
            for pos in positions[:10]:  # Show first 10
                symbol = pos.get('symbol', 'N/A')
                qty = pos.get('quantity', 0)
                avg_cost = pos.get('avg_cost', 0)
                last_price = pos.get('last_price', 0)
                price_source = pos.get('price_source', 'unknown')
                price_date = pos.get('price_date', 'N/A')
                
                print(f"{symbol:<12} {qty:>10.2f} {avg_cost:>12.2f} {last_price:>12.2f} {price_source:<15} {str(price_date):<12}")
        
        # Show today's trades
        today_trades = result.get('today_trades', [])
        if today_trades:
            print(f"\n{'='*80}")
            title = "Today's Trades"
            print(f"{title:^80}")
            print(f"{'='*80}")
            print(f"{'Trade ID':<10} {'Date':<12} {'Symbol':<12} {'Side':<8} {'Qty':>10} {'Price':>10} {'Amount':>12}")
            print(f"{'-'*80}")
            
            for trade in today_trades[:10]:  # Show first 10
                trade_id = trade.get('id', 'N/A')
                trade_date = trade.get('trade_date', 'N/A')
                symbol = trade.get('symbol', 'N/A')
                side = trade.get('side', 'N/A')
                qty = trade.get('quantity', 0)
                price = trade.get('price', 0)
                amount = qty * price
                
                print(f"{str(trade_id):<10} {str(trade_date):<12} {symbol:<12} {side:<8} {qty:>10.2f} {price:>10.2f} {amount:>12.2f}")
        
        print(f"\n📌 Note: {result.get('note', 'N/A')}")
    else:
        print(f"\n❌ Status: {result.get('status', 'failed')}")
        print(f"⚠️  Error: {result.get('error', 'Unknown error')}")
    
    return result


def test_get_account_recent_trades():
    """Test getting recent trades."""
    print("\n" + "=" * 80)
    print("Testing get_account_recent_trades...")
    print("=" * 80)
    
    # Test last 7 days
    result = _handle_get_account_recent_trades(
        account_id=None,
        days=7,
        symbol=None
    )
    
    if result.get("status") == "ok":
        print(f"\n✅ Status: OK")
        date_range = result.get('date_range', {})
        print(f"📅 Date Range: {date_range.get('from')} to {date_range.get('to')}")
        print(f"📝 Trade Count: {result.get('trade_count', 0)}")
        
        trades = result.get('trades', [])
        if trades:
            print(f"\n{'='*80}")
            print(f"{'Recent Trades':^80}")
            print(f"{'='*80}")
            print(f"{'Trade ID':<10} {'Date':<12} {'Symbol':<12} {'Side':<8} {'Qty':>10} {'Price':>10} {'Fee':>8} {'Tax':>8}")
            print(f"{'-'*80}")
            
            for trade in trades[:20]:  # Show first 20
                trade_id = trade.get('trade_id', 'N/A')
                trade_date = trade.get('trade_date', 'N/A')
                symbol = trade.get('symbol', 'N/A')
                side = trade.get('side', 'N/A')
                qty = trade.get('quantity', 0)
                price = trade.get('price', 0)
                fee = trade.get('fee', 0)
                tax = trade.get('tax', 0)
                
                print(f"{str(trade_id):<10} {str(trade_date):<12} {symbol:<12} {side:<8} {qty:>10.2f} {price:>10.2f} {fee:>8.2f} {tax:>8.2f}")
            
            # Show summary
            summary = result.get('summary', {})
            print(f"\n📊 Summary:")
            print(f"   • Buy transactions: {summary.get('total_buy', 0)}")
            print(f"   • Sell transactions: {summary.get('total_sell', 0)}")
            print(f"   • Unique stocks: {summary.get('unique_stocks', 0)}")
    else:
        print(f"\n❌ Status: {result.get('status', 'failed')}")
        print(f"⚠️  Error: {result.get('error', 'Unknown error')}")
    
    return result


if __name__ == "__main__":
    print("Testing new portfolio data tools...\n")
    
    try:
        # Test current positions
        positions_result = test_get_current_positions()
        
        # Test recent trades
        trades_result = test_get_account_recent_trades()
        
        print("\n" + "=" * 80)
        print("Testing completed!")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Testing failed with exception: {e}")
        import traceback
        traceback.print_exc()
