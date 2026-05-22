#!/usr/bin/env python3
"""
Database migration script for Render.com deployment.
Adds sort_order column to conversation_session_meta table if not exists.

Usage:
    python scripts/migrate_render_db.py
"""
import sqlite3
import os
from pathlib import Path


def migrate():
    """Add sort_order column to conversation_session_meta table."""
    # Get database path from environment or use default
    db_path = Path(os.environ.get('DATABASE_PATH', '/var/data/stock_analysis.db'))
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        print("   This is expected on first deployment.")
        return False
    
    print(f"📦 Migrating database: {db_path}")
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if sort_order column already exists
        cursor.execute("PRAGMA table_info(conversation_session_meta)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "sort_order" in columns:
            print("✅ sort_order column already exists - no migration needed")
            conn.close()
            return True
        
        # Add sort_order column
        print("⚙️  Adding sort_order column to conversation_session_meta...")
        cursor.execute("""
            ALTER TABLE conversation_session_meta 
            ADD COLUMN sort_order INTEGER
        """)
        
        conn.commit()
        conn.close()
        
        print("✅ Migration completed successfully")
        print("   - Added 'sort_order' column (INTEGER, nullable)")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


if __name__ == "__main__":
    success = migrate()
    exit(0 if success else 1)
