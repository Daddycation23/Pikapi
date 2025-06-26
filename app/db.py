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
        SELECT p.pokemon_id, p.name, p.generation, p.cost, p.height_cm, p.weight_kg, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed, p.rarity
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
        if 'rarity' in filters and filters['rarity']:
            rarity_list = [r.strip() for r in filters['rarity'].split(',') if r.strip()]
            if rarity_list:
                # Handle special cases for rarity mapping
                rarity_mapping = {
                    'non-special': None,  # This will match NULL/None values in database
                    'pseudo-legendary': 'Pseudo-Legendary',
                    'legendary': 'Legendary',
                    'mythical': 'Mythical',
                    'paradox': 'Paradox',
                    'ultra-beast': 'Ultra-Beast'
                }
                mapped_rarities = []
                for rarity in rarity_list:
                    mapped_rarity = rarity_mapping.get(rarity, rarity)
                    if mapped_rarity is None:
                        # Handle None values specially
                        where_clauses.append("p.rarity IS NULL")
                    else:
                        mapped_rarities.append(mapped_rarity)
                
                if mapped_rarities:
                    where_clauses.append(f"p.rarity IN ({','.join(['?']*len(mapped_rarities))})")
                    params.extend(mapped_rarities)
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
    
    # Add GROUP BY and HAVING clause for type filtering if needed
    if type_list:
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
    
    result = []
    for row in pokemons:
        result.append({
            'id': row['pokemon_id'],
            'name': row['name'],
            'img': f"/api/pokemon_image/{row['pokemon_id']}",
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
            'rarity': row['rarity'],
            'moves': moves_map.get(row['pokemon_id'], [])
        })
    conn.close()
    return result

def fetch_pokemon_by_id(pokemon_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.pokemon_id, p.name, p.generation, p.cost, p.height_cm, p.weight_kg, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed, p.rarity
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
        'img': f"/api/pokemon_image/{row['pokemon_id']}",
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
        'rarity': row['rarity'],
        'moves': moves
    }
    conn.close()
    return result 

def save_team(player_id, pokemon_ids, team_name='Team 1', budget=10):
    """
    Upsert a team for the player and update the Pokémon in the team.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    # Check if team exists for player
    cur.execute("SELECT team_id FROM Team WHERE player_id = ?", (player_id,))
    row = cur.fetchone()
    if row:
        team_id = row['team_id']
        # Update team name and updated_at (if you add updated_at column)
        cur.execute("UPDATE Team SET budget = ? WHERE team_id = ?", (budget, team_id))
    else:
        cur.execute("INSERT INTO Team (budget, player_id) VALUES (?, ?)", (budget, player_id))
        team_id = cur.lastrowid
    # Remove old team Pokémon
    cur.execute("DELETE FROM TeamPokemon WHERE team_id = ?", (team_id,))
    # Insert new team Pokémon
    for slot, pokemon_id in enumerate(pokemon_ids):
        cur.execute("INSERT INTO TeamPokemon (team_id, pokemon_id, slot) VALUES (?, ?, ?)", (team_id, pokemon_id, slot))
    conn.commit()
    conn.close()
    return True


def get_team(player_id):
    """
    Get the player's team as a list of Pokémon IDs (ordered by slot).
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT team_id FROM Team WHERE player_id = ?", (player_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return []
    team_id = row['team_id']
    cur.execute("SELECT pokemon_id FROM TeamPokemon WHERE team_id = ? ORDER BY slot", (team_id,))
    pokemon_ids = [r['pokemon_id'] for r in cur.fetchall()]
    conn.close()
    return pokemon_ids 

def list_teams(player_id):
    """
    List all teams for a player, returning [{'team_id': ..., 'team_name': ..., 'created_at': ...}, ...]
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT team_id, created_at FROM Team WHERE player_id = ? ORDER BY team_id", (player_id,))
    teams = [{'team_id': row['team_id'], 'team_name': f'Team {i+1}', 'created_at': row['created_at']} for i, row in enumerate(cur.fetchall())]
    conn.close()
    return teams

def get_team_by_id(team_id):
    """
    Get the team as a list of Pokémon IDs (ordered by slot) for a given team_id.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT pokemon_id FROM TeamPokemon WHERE team_id = ? ORDER BY slot", (team_id,))
    pokemon_ids = [r['pokemon_id'] for r in cur.fetchall()]
    conn.close()
    return pokemon_ids

def save_team_by_id(team_id, pokemon_ids):
    """
    Update the Pokémon in the team for a given team_id.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM TeamPokemon WHERE team_id = ?", (team_id,))
    for slot, pokemon_id in enumerate(pokemon_ids):
        cur.execute("INSERT INTO TeamPokemon (team_id, pokemon_id, slot) VALUES (?, ?, ?)", (team_id, pokemon_id, slot))
    conn.commit()
    conn.close()
    return True

def create_team(player_id, budget=10):
    """
    Create a new team for the player and return its team_id.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO Team (budget, player_id) VALUES (?, ?)", (budget, player_id))
    team_id = cur.lastrowid
    conn.commit()
    conn.close()
    return team_id 