from flask import render_template, request, jsonify, session
from app.db import fetch_pokemon, fetch_pokemon_by_id
import bcrypt
from mongo_client import get_player_profiles_collection, get_teams_collection
from datetime import datetime

def register_routes(app):
    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/edit_team')
    def edit_team():
        # Remove default team, fetch from MongoDB if logged in
        def get_current_user():
            user_id = session.get('user_id')
            username = session.get('username')
            if not user_id or not username:
                return None
            return {'_id': user_id, 'username': username}
        user = get_current_user()
        team = []
        if user:
            teams = get_teams_collection()
            team_doc = teams.find_one({'player_id': user['_id']})
            if team_doc and team_doc.get('pokemon_ids'):
                team = [fetch_pokemon_by_id(pid) for pid in team_doc['pokemon_ids']]
        return render_template('edit_team.html', team=team)

    @app.route('/api/pokemon')
    def get_pokemon():
        filters = {
            'search': request.args.get('search', '').lower(),
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
        from app.db import get_db_connection
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

    # User Registration
    @app.route('/api/register', methods=['POST'])
    def register():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        profiles = get_player_profiles_collection()
        if profiles.find_one({'username': username}):
            return jsonify({'error': 'Username already exists'}), 409

        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        profiles.insert_one({
            'username': username,
            'password_hash': password_hash,
            'registration_date': datetime.utcnow()
        })
        return jsonify({'success': True})

    # User Login
    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        profiles = get_player_profiles_collection()
        user = profiles.find_one({'username': username})
        if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
            return jsonify({'error': 'Invalid credentials'}), 401

        session['user_id'] = str(user['_id'])
        session['username'] = user['username']
        return jsonify({'success': True, 'username': user['username']})

    # User Logout
    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.clear()
        return jsonify({'success': True})

    # Helper to get current user
    def get_current_user():
        user_id = session.get('user_id')
        username = session.get('username')
        if not user_id or not username:
            return None
        return {'_id': user_id, 'username': username}

    # --- Save Team Endpoint ---
    @app.route('/api/team/save', methods=['POST'])
    def save_team():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not logged in'}), 401

        data = request.json
        pokemon_ids = data.get('pokemon_ids', [])
        team_name = data.get('team_name', 'Team 1')

        # Validate Pokémon IDs using SQLite
        if not pokemon_ids or not isinstance(pokemon_ids, list):
            return jsonify({'error': 'Invalid team data'}), 400
        from app.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        q_marks = ','.join(['?']*len(pokemon_ids))
        cur.execute(f"SELECT pokemon_id FROM Pokemon WHERE pokemon_id IN ({q_marks})", pokemon_ids)
        valid_ids = {row['pokemon_id'] for row in cur.fetchall()}
        conn.close()
        if set(pokemon_ids) != valid_ids:
            return jsonify({'error': 'Invalid Pokémon in team'}), 400

        # Save to MongoDB (multiple teams per user)
        teams = get_teams_collection()
        teams.update_one(
            {'player_id': user['_id'], 'team_name': team_name},
            {'$set': {
                'pokemon_ids': pokemon_ids,
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
        team_name = request.args.get('team_name', 'Team 1')
        teams = get_teams_collection()
        team_doc = teams.find_one({'player_id': user['_id'], 'team_name': team_name})
        if not team_doc or not team_doc.get('pokemon_ids'):
            return jsonify({'team': []})
        team = [fetch_pokemon_by_id(pid) for pid in team_doc['pokemon_ids']]
        return jsonify({'team': team})

    @app.route('/api/teams', methods=['GET'])
    def list_teams():
        user = get_current_user()
        if not user:
            return jsonify({'teams': []})
        teams = get_teams_collection()
        team_docs = list(teams.find({'player_id': user['_id']}))
        result = [
            {
                'team_name': doc.get('team_name', ''),
                'pokemon_ids': doc.get('pokemon_ids', []),
                'updated_at': doc.get('updated_at'),
                'created_at': doc.get('created_at')
            }
            for doc in team_docs
        ]
        return jsonify({'teams': result})

    @app.route('/api/me')
    def get_me():
        user = get_current_user()
        if user:
            return jsonify({'username': user['username']})
        return jsonify({'username': None}) 