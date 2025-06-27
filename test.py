import sqlite3
import sys

DB_PATH = 'pokemon.db'

def get_all_tables():
    """Get all table names in the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables

def print_table(table_name):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        print(f"\n===== {table_name.upper()} ({len(rows)} rows) =====\n")
        print(" | ".join(columns))
        print("-" * (len(" | ".join(columns)) + 2))
        for row in rows:
            print(" | ".join(str(item) if item is not None else "NULL" for item in row))
        print()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

def main():
    if len(sys.argv) == 2:
        table_name = sys.argv[1]
        print_table(table_name)
    else:
        tables = get_all_tables()
        print("Tables in pokemon.db:")
        for t in tables:
            print("-", t)
        print("\nUsage: python app/test.py table_name\nTo view all data in a table.")

if __name__ == "__main__":
    main()
