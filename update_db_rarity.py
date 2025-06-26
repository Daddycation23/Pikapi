import sqlite3
import pandas as pd

def update_database_with_rarity():
    """Add rarity column to existing database and update with CSV data"""
    db_path = 'pokemon.db'
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Check if rarity column exists
    cur.execute("PRAGMA table_info(Pokemon)")
    columns = [column[1] for column in cur.fetchall()]
    
    if 'rarity' not in columns:
        print("Adding rarity column to Pokemon table...")
        cur.execute("ALTER TABLE Pokemon ADD COLUMN rarity VARCHAR(32)")
        conn.commit()
        print("Rarity column added successfully!")
    else:
        print("Rarity column already exists!")
    
    # Load rarity data from CSV
    print("Loading rarity data from CSV...")
    csv_path = 'CSV/Pokemon_new.csv'
    df = pd.read_csv(csv_path)
    
    # Update each Pokemon with its rarity
    updated_count = 0
    for _, row in df.iterrows():
        pokemon_id = int(row['ID'])
        rarity = row['Rarity'] if pd.notna(row['Rarity']) else None
        
        cur.execute("UPDATE Pokemon SET rarity = ? WHERE pokemon_id = ?", (rarity, pokemon_id))
        if cur.rowcount > 0:
            updated_count += 1
    
    conn.commit()
    conn.close()
    
    print(f"Updated {updated_count} Pokemon with rarity data!")
    
    # Test the rarity values
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT rarity FROM Pokemon WHERE rarity IS NOT NULL")
    rarities = [row[0] for row in cur.fetchall()]
    print(f"Rarity values in database: {rarities}")
    conn.close()

if __name__ == '__main__':
    update_database_with_rarity() 