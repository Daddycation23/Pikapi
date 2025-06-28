import pandas as pd
import sqlite3
import os

DB_NAME = 'pokemon.db'
SCHEMA_FILE = './schema.sql'

def create_database():
    """Create the database and tables from schema"""
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
        print("Database schema setup complete.")

# --- Loader for Type.csv ---
def load_types():
    CSV_PATH = os.path.join('CSV', 'Type.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    inserted = 0
    for _, row in df.iterrows():
        type_id = int(row['type_id'])
        type_name = row['type_name']
        cur.execute('SELECT 1 FROM Type WHERE type_id = ?', (type_id,))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO Type (type_id, type_name)
            VALUES (?, ?)
        ''', (type_id, type_name))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new types into the database.")

# --- Loader for Pokemon.csv ---
def load_pokemon():
    CSV_PATH = os.path.join('CSV', 'Pokemon_new.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    inserted = 0
    for _, row in df.iterrows():
        pokemon_id = int(row['ID'])
        name = row['Name']
        generation = int(row['Generation'])
        hp = int(row['HP'])
        atk = int(row['Attack'])
        defense = int(row['Defense'])
        sp_atk = int(row['Sp. Atk'])
        sp_def = int(row['Sp. Def'])
        speed = int(row['Speed'])
        total_stats = hp + atk + defense + sp_atk + sp_def + speed
        if total_stats < 300:
            cost = 1
        elif total_stats < 400:
            cost = 2
        elif total_stats < 500:
            cost = 3
        elif total_stats < 600:
            cost = 4
        else:
            cost = 5
        height_cm = row.get('height_cm', None)
        weight_kg = row.get('weight_kg', None)
        rarity = row.get('Rarity', None)
        cur.execute('SELECT 1 FROM Pokemon WHERE pokemon_id = ?', (pokemon_id,))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO Pokemon (pokemon_id, name, generation, cost, height_cm, weight_kg, hp, atk, def, sp_atk, sp_def, speed, rarity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (pokemon_id, name, generation, cost, height_cm, weight_kg, hp, atk, defense, sp_atk, sp_def, speed, rarity))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new Pokémon into the database.")

# --- Loader for moves_cleaned.csv ---
def load_moves():
    CSV_PATH = os.path.join('CSV', 'moves_cleaned.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    inserted = 0
    
    # Define move categories based on type
    # Physical types: Normal(1), Fighting(2), Flying(3), Poison(4), Ground(5), Rock(6), Bug(7), Ghost(8), Steel(9), Dark(17)
    # Special types: Fire(10), Water(11), Electric(13), Grass(12), Ice(15), Psychic(14), Dragon(16), Fairy(18)
    physical_types = {1, 2, 3, 4, 5, 6, 7, 8, 9, 17}
    
    for _, row in df.iterrows():
        move_id = int(row['id'])
        type_id = int(row['type_id'])
        move_name = row['identifier']
        power = int(row['power']) if not pd.isna(row['power']) else 0
        accuracy = int(row['accuracy']) if not pd.isna(row['accuracy']) else 0
        priority = int(row['priority']) if not pd.isna(row['priority']) else 0
        
        # Determine category based on type
        category = 'physical' if type_id in physical_types else 'special'
        
        cur.execute('SELECT 1 FROM Move WHERE move_id = ?', (move_id,))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO Move (move_id, type_id, move_name, power, accuracy, priority, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (move_id, type_id, move_name, power, accuracy, priority, category))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new moves into the database.")

# --- Loader for PokemonHasType.csv ---
def load_pokemonhastype():
    CSV_PATH = os.path.join('CSV', 'PokemonHasType.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    inserted = 0
    for _, row in df.iterrows():
        pokemon_id = int(row['pokemon_id'])
        type_id = int(row['type_id'])
        cur.execute('SELECT 1 FROM PokemonHasType WHERE type_id = ? AND pokemon_id = ?', (type_id, pokemon_id))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO PokemonHasType (type_id, pokemon_id)
            VALUES (?, ?)
        ''', (type_id, pokemon_id))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new Pokemon-type relations into the database.")

# --- Loader for TypeEffectiveness.csv ---
def load_typeeffectiveness():
    CSV_PATH = os.path.join('CSV', 'TypeEffectiveness.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    inserted = 0
    for _, row in df.iterrows():
        attacking_type_id = int(row['damage_type_id'])
        defending_type_id = int(row['target_type_id'])
        effectiveness = float(row['damage_factor']) / 100.0
        cur.execute('SELECT 1 FROM TypeEffectiveness WHERE attacking_type_id = ? AND defending_type_id = ?', (attacking_type_id, defending_type_id))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO TypeEffectiveness (attacking_type_id, defending_type_id, effectiveness)
            VALUES (?, ?, ?)
        ''', (attacking_type_id, defending_type_id, effectiveness))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new type effectiveness relations into the database.")

# --- Loader for pokemon_moves.csv ---
def load_pokemon_moves():
    CSV_PATH = os.path.join('CSV', 'pokemon_moves.csv')
    df = pd.read_csv(CSV_PATH, usecols=['pokemon_id', 'move_id'])
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    inserted = 0
    for _, row in df.iterrows():
        pokemon_id = int(row['pokemon_id'])
        move_id = int(row['move_id'])
        cur.execute('SELECT 1 FROM PokemonHasMove WHERE move_id = ? AND pokemon_id = ?', (move_id, pokemon_id))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO PokemonHasMove (move_id, pokemon_id)
            VALUES (?, ?)
        ''', (move_id, pokemon_id))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new Pokémon-move relations into the database.")

def insert_images():
    """Insert Pokémon images from static/images folder"""
    IMAGES_DIR = os.path.join('static', 'images')
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    count = 0
    for filename in os.listdir(IMAGES_DIR):
        if filename.endswith('.png'):
            try:
                pokemon_id = int(os.path.splitext(filename)[0])
            except ValueError:
                print(f"Skipping {filename}: not a valid pokemon_id")
                continue
            image_path = os.path.join(IMAGES_DIR, filename)
            with open(image_path, 'rb') as f:
                image_data = f.read()
            cur.execute(
                "UPDATE Pokemon SET image = ? WHERE pokemon_id = ?",
                (image_data, pokemon_id)
            )
            count += 1
    conn.commit()
    conn.close()
    print(f"Inserted images for {count} Pokémon.")

def main():
    """Main function to initialize the complete database"""
    print("=== Pokémon Database Initialization ===")
    print()
    
    # Step 1: Create database schema
    create_database()
    print()
    
    # Step 2: Load all CSV data
    print("Loading CSV data...")
    load_types()
    load_pokemon()
    load_moves()
    load_pokemonhastype()
    load_typeeffectiveness()
    load_pokemon_moves()
    print()
    
    # Step 3: Insert images
    print("Loading images...")
    insert_images()
    print()
    
    print("=== Database initialization complete! ===")

if __name__ == '__main__':
    main() 