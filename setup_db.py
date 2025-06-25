import sqlite3

DB_NAME = 'pokemon.db'
SCHEMA_FILE = './schema.sql'

def main():
    print(f"Connecting to database '{DB_NAME}'...")
    conn = sqlite3.connect(DB_NAME)
    try:
        print("Creating tables...")
        with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        print("All tables created successfully.")
    finally:
        conn.close()
        print("Connection closed.")

if __name__ == '__main__':
    main()