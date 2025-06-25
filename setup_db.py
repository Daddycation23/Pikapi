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

def fetch_pokemon(filters=None):
    conn = get_db_connection()
    cur = conn.cursor()
    base_query = """
        SELECT DISTINCT p.pokemon_id, p.name, p.generation, p.cost, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
        FROM Pokemon p
    """
    join_clauses = ""
    where_clauses = []
    params = []

    # Type filter: add JOINs if needed
    type_list = []
    if filters and 'types' in filters and filters['types']:
        type_list = [t.strip().capitalize() for t in filters['types'].split(',') if t.strip()]
        if type_list:
            join_clauses += " JOIN PokemonHasType pht ON p.pokemon_id = pht.pokemon_id JOIN Type t ON pht.type_id = t.type_id"
            where_clauses.append(f"t.type_name IN ({','.join(['?']*len(type_list))})")
            params.extend(type_list)

    # Other filters
    if filters:
        if 'search' in filters and filters['search']:
            where_clauses.append("LOWER(p.name) LIKE ?")
            params.append(f"%{filters['search'].lower()}%")
        if 'cost' in filters and filters['cost']:
            where_clauses.append("p.cost = ?")
            params.append(filters['cost'])
        if 'cost_min' in filters and filters['cost_min'] is not None:
            where_clauses.append("p.cost >= ?")
            params.append(filters['cost_min'])
        if 'cost_max' in filters and filters['cost_max'] is not None:
            where_clauses.append("p.cost <= ?")
            params.append(filters['cost_max'])
        if 'generations' in filters and filters['generations']:
            gen_list = [int(g.strip()) for g in filters['generations'].split(',') if g.strip().isdigit()]
            if gen_list:
                where_clauses.append(f"p.generation IN ({','.join(['?']*len(gen_list))})")
                params.extend(gen_list)
        for stat in ['hp', 'atk', 'def', 'sp_atk', 'sp_def', 'speed']:
            min_key = f'{stat}_min'
            max_key = f'{stat}_max'
            if min_key in filters and filters[min_key] is not None:
                where_clauses.append(f"p.{stat} >= ?")
                params.append(filters[min_key])
            if max_key in filters and filters[max_key] is not None:
                where_clauses.append(f"p.{stat} <= ?")
                params.append(filters[max_key])

    query = base_query + join_clauses
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
    cur.execute(query, params)
    pokemons = cur.fetchall()
    # ... rest of your code ...

if __name__ == '__main__':
    main()