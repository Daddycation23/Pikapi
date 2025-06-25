import pandas as pd
import sqlite3
import os

DB_PATH = 'pokemon.db'

# --- Loader for Type.csv ---
def load_types():
    CSV_PATH = os.path.join('CSV', 'Type.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_PATH)
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
def calculate_cost(row):
    total_stats = row['HP'] + row['Attack'] + row['Defense'] + row['Sp. Atk'] + row['Sp. Def'] + row['Speed']
    if total_stats < 300:
        return 1
    elif total_stats < 400:
        return 2
    elif total_stats < 500:
        return 3
    elif total_stats < 600:
        return 4
    else:
        return 5

def load_pokemon():
    CSV_PATH = os.path.join('CSV', 'Pokemon_new.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_PATH)
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
        cur.execute('SELECT 1 FROM Pokemon WHERE pokemon_id = ?', (pokemon_id,))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO Pokemon (pokemon_id, name, generation, cost, height_cm, weight_kg, hp, atk, def, sp_atk, sp_def, speed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (pokemon_id, name, generation, cost, height_cm, weight_kg, hp, atk, defense, sp_atk, sp_def, speed))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new Pokémon into the database.")

# --- Loader for moves_cleaned.csv ---
def load_moves():
    CSV_PATH = os.path.join('CSV', 'moves_cleaned.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    inserted = 0
    for _, row in df.iterrows():
        move_id = int(row['id'])
        type_id = int(row['type_id'])
        move_name = row['identifier']
        power = int(row['power']) if not pd.isna(row['power']) else 0
        accuracy = int(row['accuracy']) if not pd.isna(row['accuracy']) else 0
        cur.execute('SELECT 1 FROM Move WHERE move_id = ?', (move_id,))
        if cur.fetchone():
            continue
        cur.execute('''
            INSERT INTO Move (move_id, type_id, move_name, power, accuracy)
            VALUES (?, ?, ?, ?, ?)
        ''', (move_id, type_id, move_name, power, accuracy))
        inserted += 1
    conn.commit()
    conn.close()
    print(f"Inserted {inserted} new moves into the database.")

# --- Loader for PokemonHasType.csv ---
def load_pokemonhastype():
    CSV_PATH = os.path.join('CSV', 'PokemonHasType.csv')
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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


IMAGES_DIR = os.path.join('static', 'images')

def insert_images():
    conn = sqlite3.connect(DB_PATH)
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

# --- Main function to run all loaders in order ---
def main():
    load_types()
    load_pokemon()
    load_moves()
    load_pokemonhastype()
    load_typeeffectiveness()
    load_pokemon_moves()
    insert_images() 

if __name__ == '__main__':
    main() 