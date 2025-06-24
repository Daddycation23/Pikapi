from flask import Flask, render_template, request, jsonify
import sqlite3
import json

app = Flask(__name__)

DB_PATH = 'pokemon.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def pokemon_name_to_filename(name):
    """Convert Pokemon name to image filename format"""
    # Convert to lowercase
    filename = name.lower()
    
    # Handle special characters
    filename = filename.replace("♀", "-f")  # Female symbol
    filename = filename.replace("♂", "-m")  # Male symbol
    filename = filename.replace("'", "")    # Remove apostrophes
    filename = filename.replace(".", "-")   # Replace periods with hyphens
    filename = filename.replace(" ", "-")   # Replace spaces with hyphens
    filename = filename.replace("deoxys", "deoxys-normal") # Special pokemon cases
    filename = filename.replace("mr--mime", "mr-mime") # Special pokemon cases
    
    return filename

def fetch_pokemon(filters=None):
    conn = get_db_connection()
    cur = conn.cursor()
    # Build base query
    query = """
        SELECT p.pokemon_id, p.name, p.generation, p.cost, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
        FROM Pokemon p
    """
    where_clauses = []
    params = []
    # Filtering logic
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
            gen_list = [g.strip() for g in filters['generations'].split(',')]
            where_clauses.append(f"p.generation IN ({','.join(['?']*len(gen_list))})")
            params.extend(gen_list)
        # Stat filters
        for stat in ['hp', 'atk', 'def', 'sp_atk', 'sp_def', 'speed']:
            min_key = f'{stat}_min'
            max_key = f'{stat}_max'
            if min_key in filters and filters[min_key] is not None:
                where_clauses.append(f"p.{stat} >= ?")
                params.append(filters[min_key])
            if max_key in filters and filters[max_key] is not None:
                where_clauses.append(f"p.{stat} <= ?")
                params.append(filters[max_key])
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
            SELECT pht.pokemon_id, t.type_name, pht.slot
            FROM PokemonHasType pht
            JOIN Type t ON pht.type_id = t.type_id
            WHERE pht.pokemon_id IN ({q_marks})
            ORDER BY pht.slot
        """, pokemon_ids)
        for row in cur.fetchall():
            types_map.setdefault(row['pokemon_id'], []).append(row['type_name'])
    # Build output
    result = []
    for row in pokemons:
        result.append({
            'id': row['pokemon_id'],
            'name': row['name'],
            'img': f"/static/images/{pokemon_name_to_filename(row['name'])}.png",
            'cost': row['cost'],
            'type': types_map.get(row['pokemon_id'], []),
            'hp': row['hp'],
            'attack': row['atk'],
            'defense': row['def'],
            'sp_atk': row['sp_atk'],
            'sp_def': row['sp_def'],
            'speed': row['speed'],
            'gen': str(row['generation'])
        })
    conn.close()
    return result

def fetch_pokemon_by_id(pokemon_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.pokemon_id, p.name, p.generation, p.cost, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
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
        WHERE pht.pokemon_id = ? ORDER BY pht.slot
    """, (pokemon_id,))
    types = [r['type_name'] for r in cur.fetchall()]
    result = {
        'id': row['pokemon_id'],
        'name': row['name'],
        'img': f"/static/images/{pokemon_name_to_filename(row['name'])}.png",
        'cost': row['cost'],
        'type': types,
        'hp': row['hp'],
        'attack': row['atk'],
        'defense': row['def'],
        'sp_atk': row['sp_atk'],
        'sp_def': row['sp_def'],
        'speed': row['speed'],
        'gen': str(row['generation'])
    }
    conn.close()
    return result

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/edit_team')
def edit_team():
    # Example: fetch 3 Pokémon by ID for the team
    team_ids = [25, 10, 133]  # Pikachu, Caterpie, Eevee
    team = [fetch_pokemon_by_id(pid) for pid in team_ids]
    return render_template('edit_team.html', team=team)

@app.route('/api/pokemon')
def get_pokemon():
    filters = {
        'search': request.args.get('search', '').lower(),
        'cost': request.args.get('cost', type=int),
        'cost_min': request.args.get('cost_min', type=int),
        'cost_max': request.args.get('cost_max', type=int),
        'generations': request.args.get('generations', ''),
        'hp_min': request.args.get('hp_min', type=int),
        'hp_max': request.args.get('hp_max', type=int),
        'atk_min': request.args.get('attack_min', type=int),
        'atk_max': request.args.get('attack_max', type=int),
        'def_min': request.args.get('defense_min', type=int),
        'def_max': request.args.get('defense_max', type=int),
        'sp_atk_min': request.args.get('sp_atk_min', type=int),
        'sp_atk_max': request.args.get('sp_atk_max', type=int),
        'sp_def_min': request.args.get('sp_def_min', type=int),
        'sp_def_max': request.args.get('sp_def_max', type=int),
        'speed_min': request.args.get('speed_min', type=int),
        'speed_max': request.args.get('speed_max', type=int)
    }
    # Remove None values
    filters = {k: v for k, v in filters.items() if v is not None and v != ''}
    pokemon_list = fetch_pokemon(filters)
    return jsonify(pokemon_list)

@app.route('/api/pokemon/<int:pokemon_id>')
def get_pokemon_detail(pokemon_id):
    pokemon = fetch_pokemon_by_id(pokemon_id)
    if pokemon:
        return jsonify(pokemon)
    return jsonify({'error': 'Pokemon not found'}), 404

@app.route('/api/team/validate', methods=['POST'])
def validate_team():
    team_data = request.json.get('team', [])
    ids = [p.get('id') for p in team_data if p.get('id')]
    if not ids:
        return jsonify({'valid': True, 'total_cost': 0, 'max_cost': 10, 'remaining_cost': 10})
    conn = get_db_connection()
    cur = conn.cursor()
    q_marks = ','.join(['?']*len(ids))
    cur.execute(f"SELECT SUM(cost) FROM Pokemon WHERE pokemon_id IN ({q_marks})", ids)
    total_cost = cur.fetchone()[0] or 0
    conn.close()
    max_cost = 10
    return jsonify({
        'valid': total_cost <= max_cost,
        'total_cost': total_cost,
        'max_cost': max_cost,
        'remaining_cost': max_cost - total_cost
    })

if __name__ == '__main__':
    app.run(debug=True)