from flask import render_template, request, jsonify, session, Response, abort, make_response
from app.db import fetch_pokemon, fetch_pokemon_by_id, get_db_connection
#from app.mongo_client import get_player_profiles_collection, get_teams_collection
import bcrypt
from datetime import datetime
import sqlite3


DB_PATH = 'pokemon.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_pokemon_types(cur, pokemon_ids):
    """Fetch types for a list of Pokémon IDs."""
    if not pokemon_ids:
        return {}
    q_marks = ','.join(['?'] * len(pokemon_ids))
    cur.execute(f"""
        SELECT pht.pokemon_id, t.type_name
        FROM PokemonHasType pht
        JOIN Type t ON pht.type_id = t.type_id
        WHERE pht.pokemon_id IN ({q_marks})
        ORDER BY t.type_name
    """, pokemon_ids)
    types_map = {}
    for row in cur.fetchall():
        types_map.setdefault(row['pokemon_id'], []).append(row['type_name'])
    return types_map

def build_pokemon_result(rows, types_map):
    """Builds the result list of Pokémon dicts."""
    result = []
    for row in rows:
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
            'gen': str(row['generation'])
        })
    return result

def fetch_pokemon(filters=None):
    """Fetch Pokémon from the database with optional filters."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        base_query = """
            SELECT p.pokemon_id, p.name, p.generation, p.cost, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
            FROM Pokemon p
        """
        join_clauses = ""
        where_clauses = []
        params = []

        # Type filter
        type_list = []
        if filters and 'types' in filters and filters['types']:
            type_list = [t.strip().lower() for t in filters['types'].split(',') if t.strip()]
            if type_list:
                join_clauses += " JOIN PokemonHasType pht ON p.pokemon_id = pht.pokemon_id JOIN Type t ON pht.type_id = t.type_id"
                where_clauses.append(f"LOWER(t.type_name) IN ({','.join(['?']*len(type_list))})")
                params.extend(type_list)
                query = base_query + join_clauses
                if where_clauses:
                    query += " WHERE " + " AND ".join(where_clauses)
                query += f" GROUP BY p.pokemon_id HAVING COUNT(DISTINCT LOWER(t.type_name)) = {len(type_list)}"
                cur.execute(query, params)
                pokemons = cur.fetchall()
                pokemon_ids = [row['pokemon_id'] for row in pokemons]
                types_map = get_pokemon_types(cur, pokemon_ids)
                return build_pokemon_result(pokemons, types_map)

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
        pokemon_ids = [row['pokemon_id'] for row in pokemons]
        types_map = get_pokemon_types(cur, pokemon_ids)
        return build_pokemon_result(pokemons, types_map)

def fetch_pokemon_by_id(pokemon_id):
    """Fetch a single Pokémon by its ID."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT p.pokemon_id, p.name, p.generation, p.cost, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
            FROM Pokemon p WHERE p.pokemon_id = ?
        """, (pokemon_id,))
        row = cur.fetchone()
        if not row:
            return None
        cur.execute("""
            SELECT t.type_name FROM PokemonHasType pht
            JOIN Type t ON pht.type_id = t.type_id
            WHERE pht.pokemon_id = ? ORDER BY t.type_name
        """, (pokemon_id,))
        types = [r['type_name'] for r in cur.fetchall()]
        return {
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
            'gen': str(row['generation'])
        }

def register_routes(app):
    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/edit_team')
    def edit_team():
        def get_current_user():
            user_id = session.get('user_id')
            username = session.get('username')
            if not user_id or not username:
                return None
            return {'_id': user_id, 'username': username}
        user = get_current_user()
        team = []
        # if user:
        #     with get_db_connection() as conn:
        #         cur = conn.cursor()
        #         cur.execute("SELECT pokemon_ids FROM PlayerTeam WHERE player_id = ?", (user['_id'],))
        #         row = cur.fetchone()
        #         if row and row['pokemon_ids']:
        #             team_ids = [int(pid) for pid in row['pokemon_ids'].split(',') if pid]
        #             team = [fetch_pokemon_by_id(pid) for pid in team_ids]
        return render_template('edit_team.html', team=team)

    @app.route('/api/pokemon')
    def get_pokemon():
        filters = {
            'search': request.args.get('search', ''),
            'cost': request.args.get('cost', type=int),
            'cost_min': request.args.get('cost_min', type=int),
            'cost_max': request.args.get('cost_max', type=int),
            'generations': request.args.get('generations', ''),
            'types': request.args.get('types', ''),
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
        # Only filter out None values, keep empty strings for proper filter logic
        filters = {k: v for k, v in filters.items() if v is not None}
        pokemon_list = fetch_pokemon(filters)
        return jsonify(pokemon_list)

    @app.route('/api/pokemon/<int:pokemon_id>')
    def get_pokemon_detail(pokemon_id):
        pokemon = fetch_pokemon_by_id(pokemon_id)
        if pokemon:
            return jsonify({'success': True, 'pokemon': pokemon})
        return jsonify({'success': False, 'error': 'Pokemon not found'}), 404

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

    @app.route('/api/register', methods=['POST'])
    def register():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')  # <-- get email

        if not username or not password or not email:
            return jsonify({'error': 'Username, password, and email required'}), 400

        with get_db_connection() as conn:
            cur = conn.cursor()
            # Check if username or email exists
            cur.execute("SELECT 1 FROM Player WHERE username = ?", (username,))
            if cur.fetchone():
                return jsonify({'error': 'Username already exists'}), 409
            cur.execute("SELECT 1 FROM Player WHERE email = ?", (email,))
            if cur.fetchone():
                return jsonify({'error': 'Email already exists'}), 409

            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            cur.execute(
                "INSERT INTO Player (username, email, password_hash, registration_date) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                (username, email, password_hash)
            )
            conn.commit()
        return jsonify({'success': True})

    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT player_id, username, password_hash FROM Player WHERE username = ?", (username,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid credentials'}), 401

            # password_hash is stored as bytes in SQLite, so ensure correct type
            db_hash = user['password_hash']
            if isinstance(db_hash, str):
                db_hash = db_hash.encode('utf-8')

            if not bcrypt.checkpw(password.encode('utf-8'), db_hash):
                return jsonify({'error': 'Invalid credentials'}), 401

            session['user_id'] = str(user['player_id'])
            session['username'] = user['username']
            return jsonify({'success': True, 'username': user['username']})

    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.clear()
        return jsonify({'success': True})

    def get_current_user():
        user_id = session.get('user_id')
        username = session.get('username')
        if not user_id or not username:
            return None
        return {'_id': user_id, 'username': username}

    @app.route('/api/team/save', methods=['POST'])
    def save_team():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not logged in'}), 401

        data = request.json
        pokemon_ids = data.get('pokemon_ids', [])
        team_name = data.get('team_name', 'Team 1')

        if not pokemon_ids or not isinstance(pokemon_ids, list):
            return jsonify({'error': 'Invalid team data'}), 400
        conn = get_db_connection()
        cur = conn.cursor()
        q_marks = ','.join(['?']*len(pokemon_ids))
        cur.execute(f"SELECT pokemon_id FROM Pokemon WHERE pokemon_id IN ({q_marks})", pokemon_ids)
        valid_ids = {row['pokemon_id'] for row in cur.fetchall()}
        conn.close()
        if set(pokemon_ids) != valid_ids:
            return jsonify({'error': 'Invalid Pokémon in team'}), 400

        #teams = get_teams_collection()
        teams.update_one(
            {'player_id': user['_id']},
            {'$set': {
                'pokemon_ids': pokemon_ids,
                'team_name': team_name,
                'updated_at': datetime.utcnow()
            }, '$setOnInsert': {
                'created_at': datetime.utcnow()
            }},
            upsert=True
        )
        return jsonify({'success': True})

    @app.route('/api/team', methods=['GET'])
    def get_team():
        user = get_current_user()
        if not user:
            return jsonify({'team': []})
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT pokemon_ids FROM PlayerTeam WHERE player_id = ?", (user['_id'],))
            row = cur.fetchone()
            if not row or not row['pokemon_ids']:
                return jsonify({'team': []})
            team_ids = [int(pid) for pid in row['pokemon_ids'].split(',') if pid]
            team = [fetch_pokemon_by_id(pid) for pid in team_ids]
            return jsonify({'team': team})

    @app.route('/api/me')
    def get_me():
        user = get_current_user()
        if user:
            return jsonify({'username': user['username']})
        return jsonify({'username': None})

    @app.route('/api/pokemon_image/<int:pokemon_id>')
    def pokemon_image(pokemon_id):
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT image FROM Pokemon WHERE pokemon_id = ?", (pokemon_id,))
            row = cur.fetchone()
            if row and row['image']:
                response = make_response(row['image'])
                response.headers.set('Content-Type', 'image/png')
                response.headers.set('Cache-Control', 'public, max-age=31536000')
                return response
            else:
                abort(404)