import sqlite3
#from app.utils import pokemon_name_to_filename

DB_PATH = 'pokemon.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --- Data Access Functions ---

def fetch_pokemon(filters=None):
    conn = get_db_connection()
    cur = conn.cursor()
    base_query = """
        SELECT p.pokemon_id, p.name, p.generation, p.cost, p.height_cm, p.weight_kg, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
        FROM Pokemon p
    """
    join_clauses = ""
    where_clauses = []
    params = []

    # Type filter: add JOINs if needed
    type_list = []
    if filters and 'types' in filters and filters['types']:
        type_list = [t.strip().lower() for t in filters['types'].split(',') if t.strip()]
        if type_list:
            join_clauses += " JOIN PokemonHasType pht ON p.pokemon_id = pht.pokemon_id JOIN Type t ON pht.type_id = t.type_id"
            # Use GROUP BY and HAVING to ensure Pokémon have ALL selected types
            where_clauses.append(f"LOWER(t.type_name) IN ({','.join(['?']*len(type_list))})")
            params.extend(type_list)
            # Add GROUP BY and HAVING clause to ensure all types are present
            query = base_query + join_clauses
            if where_clauses:
                query += " WHERE " + " AND ".join(where_clauses)
            query += f" GROUP BY p.pokemon_id HAVING COUNT(DISTINCT LOWER(t.type_name)) = {len(type_list)}"
            cur.execute(query, params)
            pokemons = cur.fetchall()
            # Fetch types for all pokemon in one go
            pokemon_ids = [row['pokemon_id'] for row in pokemons]
            types_map = {}
            if pokemon_ids:
                q_marks = ','.join(['?']*len(pokemon_ids))
                cur.execute(f"""
                    SELECT pht.pokemon_id, t.type_name
                    FROM PokemonHasType pht
                    JOIN Type t ON pht.type_id = t.type_id
                    WHERE pht.pokemon_id IN ({q_marks})
                    ORDER BY t.type_name
                """, pokemon_ids)
                for row in cur.fetchall():
                    types_map.setdefault(row['pokemon_id'], []).append(row['type_name'])
            
            # Fetch moves for all pokemon in bulk (only for smaller result sets)
            moves_map = {}
            if len(pokemon_ids) <= 50:  # Only fetch moves for smaller result sets to avoid performance issues
                if pokemon_ids:
                    q_marks = ','.join(['?']*len(pokemon_ids))
                    cur.execute(f"""
                        SELECT phm.pokemon_id, m.move_name
                        FROM PokemonHasMove phm
                        JOIN Move m ON phm.move_id = m.move_id
                        WHERE phm.pokemon_id IN ({q_marks})
                        ORDER BY phm.pokemon_id, m.move_name
                    """, pokemon_ids)
                    for row in cur.fetchall():
                        moves_map.setdefault(row['pokemon_id'], []).append(row['move_name'])
            
            # Build output
            result = []
            for row in pokemons:
                result.append({
                    'id': row['pokemon_id'],
                    'name': row['name'],
                    'img': f"/static/images/{row['pokemon_id']}.png",
                    'cost': row['cost'],
                    'type': types_map.get(row['pokemon_id'], []),
                    'hp': row['hp'],
                    'attack': row['atk'],
                    'defense': row['def'],
                    'sp_atk': row['sp_atk'],
                    'sp_def': row['sp_def'],
                    'speed': row['speed'],
                    'gen': str(row['generation']),
                    'height_cm': row['height_cm'],
                    'weight_kg': row['weight_kg'],
                    'moves': moves_map.get(row['pokemon_id'], [])
                })
            conn.close()
            return result

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
    # Fetch types for all pokemon in one go
    pokemon_ids = [row['pokemon_id'] for row in pokemons]
    types_map = {}
    if pokemon_ids:
        q_marks = ','.join(['?']*len(pokemon_ids))
        cur.execute(f"""
            SELECT pht.pokemon_id, t.type_name
            FROM PokemonHasType pht
            JOIN Type t ON pht.type_id = t.type_id
            WHERE pht.pokemon_id IN ({q_marks})
            ORDER BY t.type_name
        """, pokemon_ids)
        for row in cur.fetchall():
            types_map.setdefault(row['pokemon_id'], []).append(row['type_name'])
    # Build output
    # Fetch moves for all pokemon in bulk (only for detailed views)
    moves_map = {}
    if len(pokemon_ids) <= 50:  # Only fetch moves for smaller result sets to avoid performance issues
        if pokemon_ids:
            q_marks = ','.join(['?']*len(pokemon_ids))
            cur.execute(f"""
                SELECT phm.pokemon_id, m.move_name
                FROM PokemonHasMove phm
                JOIN Move m ON phm.move_id = m.move_id
                WHERE phm.pokemon_id IN ({q_marks})
                ORDER BY phm.pokemon_id, m.move_name
            """, pokemon_ids)
            for row in cur.fetchall():
                moves_map.setdefault(row['pokemon_id'], []).append(row['move_name'])
    
    result = []
    for row in pokemons:
        result.append({
            'id': row['pokemon_id'],
            'name': row['name'],
            'img': f"/static/images/{row['pokemon_id']}.png",
            'cost': row['cost'],
            'type': types_map.get(row['pokemon_id'], []),
            'hp': row['hp'],
            'attack': row['atk'],
            'defense': row['def'],
            'sp_atk': row['sp_atk'],
            'sp_def': row['sp_def'],
            'speed': row['speed'],
            'gen': str(row['generation']),
            'height_cm': row['height_cm'],
            'weight_kg': row['weight_kg'],
            'moves': moves_map.get(row['pokemon_id'], [])
        })
    conn.close()
    return result

def fetch_pokemon_by_id(pokemon_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.pokemon_id, p.name, p.generation, p.cost, p.height_cm, p.weight_kg, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
        FROM Pokemon p WHERE p.pokemon_id = ?
    """, (pokemon_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    # Fetch types
    cur.execute("""
        SELECT t.type_name FROM PokemonHasType pht
        JOIN Type t ON pht.type_id = t.type_id
        WHERE pht.pokemon_id = ? ORDER BY t.type_name
    """, (pokemon_id,))
    types = [r['type_name'] for r in cur.fetchall()]
    # Fetch moves
    cur.execute("""
        SELECT m.move_name FROM PokemonHasMove phm
        JOIN Move m ON phm.move_id = m.move_id
        WHERE phm.pokemon_id = ? ORDER BY m.move_name
    """, (pokemon_id,))
    moves = [r['move_name'] for r in cur.fetchall()]
    
    result = {
        'id': row['pokemon_id'],
        'name': row['name'],
        'img': f"/static/images/{row['pokemon_id']}.png",
        'cost': row['cost'],
        'type': types,
        'hp': row['hp'],
        'attack': row['atk'],
        'defense': row['def'],
        'sp_atk': row['sp_atk'],
        'sp_def': row['sp_def'],
        'speed': row['speed'],
        'gen': str(row['generation']),
        'height_cm': row['height_cm'],
        'weight_kg': row['weight_kg'],
        'moves': moves
    }
    conn.close()
    return result 