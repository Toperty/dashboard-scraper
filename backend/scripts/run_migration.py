#!/usr/bin/env python3
"""
Migration runner script
Usage: python scripts/run_migration.py migrations/drop_unused_valuation_columns.sql
"""
import sys
import os
import psycopg2
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from config.db_connection import get_database_url

def run_migration(migration_file: str):
    """Run a SQL migration file"""
    migration_path = Path(__file__).parent.parent / migration_file
    
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        return False
    
    try:
        # Get database URL and parse it for psycopg2
        db_url = get_database_url()
        
        # Connect directly using psycopg2 for raw SQL execution
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Read migration file
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print(f"🔄 Running migration: {migration_file}")
        print(f"📄 SQL content:")
        print("-" * 50)
        print(migration_sql)
        print("-" * 50)
        
        # Execute migration
        cursor.execute(migration_sql)
        conn.commit()
        
        print(f"✅ Migration completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/run_migration.py <migration_file>")
        print("Example: python scripts/run_migration.py migrations/drop_unused_valuation_columns.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    success = run_migration(migration_file)
    sys.exit(0 if success else 1)