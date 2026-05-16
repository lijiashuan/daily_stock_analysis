# -*- coding: utf-8 -*-
"""Check latest close prices in database."""

from datetime import date
from src.storage import DatabaseManager

db = DatabaseManager.get_instance()

codes = [
    'SH603169',  # 兰石重装
    'SH600900',  # 长江电力
    'SH600797',  # 浙大网新
    'SH601933',  # 永辉超市
    'SZ002544',  # 普天科技
    'SZ002617',  # 露笑科技
    'SZ002158',  # 汉钟精机
]

with db.get_session() as session:
    for code in codes:
        result = session.execute(
            """
            SELECT date, close FROM stock_daily 
            WHERE code = :code 
            ORDER BY date DESC 
            LIMIT 3
            """,
            {"code": code}
        ).fetchall()
        
        print(f"\n{code}:")
        if result:
            for row in result:
                print(f"  {row[0]}: {row[1]}")
        else:
            print("  No data found")
