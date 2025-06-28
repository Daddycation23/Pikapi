from flask import render_template, request, jsonify, session, Response, abort, make_response, redirect, url_for
from app.db import fetch_pokemon, fetch_pokemon_by_id, get_db_connection, save_team as db_save_team, get_team as db_get_team, list_teams, get_team_by_id, save_team_by_id, create_team
#from app.mongo_client import get_player_profiles_collection, get_teams_collection
import bcrypt
from datetime import datetime
import sqlite3
import random


DB_PATH = 'pokemon.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Helper functions removed - using enhanced functions from app.db

# Removed local functions - using enhanced functions from app.db

def register_routes(app):
    @app.route('/')
    def home():
        # Check if user is already logged in
        user_id = session.get('user_id')
        username = session.get('username')
        if user_id and username:
            # User is logged in, redirect to player page
            return redirect(url_for('player'))
        # User is not logged in, show index page
        return render_template('index.html')

    @app.route('/player')
    def player():
        # This should be the team building interface for logged-in users
        return render_template('player.html')

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
            'rarity': request.args.get('rarity', ''),
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
        return jsonify({'success': True, 'redirect': '/'})

    def get_current_user():
        user_id = session.get('user_id')
        username = session.get('username')
        if not user_id or not username:
            return None
        return {'_id': user_id, 'username': username}

    @app.route('/api/teams', methods=['GET'])
    def api_list_teams():
        user = get_current_user()
        if not user:
            return jsonify({'teams': []})
        teams = list_teams(int(user['_id']))
        return jsonify({'teams': teams})

    @app.route('/api/team', methods=['GET'])
    def get_team():
        user = get_current_user()
        if not user:
            return jsonify({'team': []})
        team_id = request.args.get('team_id', type=int)
        if team_id is None:
            teams = list_teams(int(user['_id']))
            if not teams:
                return jsonify({'team': []})
            team_id = teams[0]['team_id']
        pokemon_ids = get_team_by_id(team_id)
        team = [fetch_pokemon_by_id(pid) for pid in pokemon_ids]
        return jsonify({'team': team})

    @app.route('/api/team/save', methods=['POST'])
    def save_team():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not logged in'}), 401
        data = request.json
        pokemon_ids = data.get('pokemon_ids', [])
        team_id = data.get('team_id', None)
        if not isinstance(pokemon_ids, list):
            return jsonify({'error': 'Invalid team data'}), 400
        # Validate Pokémon IDs only if the list is not empty
        if pokemon_ids:
            conn = get_db_connection()
            cur = conn.cursor()
            q_marks = ','.join(['?']*len(pokemon_ids))
            cur.execute(f"SELECT pokemon_id FROM Pokemon WHERE pokemon_id IN ({q_marks})", pokemon_ids)
            valid_ids = {row['pokemon_id'] for row in cur.fetchall()}
            conn.close()
            if set(pokemon_ids) != valid_ids:
                return jsonify({'error': 'Invalid Pokémon in team'}), 400
        if team_id is None:
            # Create a new team if not provided (should not happen in normal UI)
            team_id = create_team(int(user['_id']))
        save_team_by_id(team_id, pokemon_ids)
        return jsonify({'success': True, 'team_id': team_id})

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

    @app.route('/battle')
    def battle():
        user = get_current_user()
        if not user:
            return redirect(url_for('home'))
        return render_template('battle.html')

    @app.route('/api/battle/start', methods=['POST'])
    def start_battle():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Get user's team
        team_ids = get_team_by_id(1)  # Default team for now
        if not team_ids:
            # Create a default team if user doesn't have one
            default_pokemon_ids = [25, 6, 9]  # Pikachu, Charizard, Blastoise
            player_team = [fetch_pokemon_by_id(pid) for pid in default_pokemon_ids]
        else:
            player_team = [fetch_pokemon_by_id(pid) for pid in team_ids]
        
        if not player_team:
            return jsonify({'error': 'Invalid team'}), 400
        
        # Generate enemy team of 3 Pokemon
        enemy_team = []
        for _ in range(3):
            enemy_pokemon = fetch_pokemon_by_id(random.randint(1, 151))  # Gen 1 Pokemon
            enemy_team.append(enemy_pokemon)
        
        # Initialize HP values properly for player team
        for pokemon in player_team:
            pokemon['max_hp'] = pokemon['hp']  # Set max HP to original HP
            pokemon['current_hp'] = pokemon['hp']  # Set current HP to max initially
        
        # Initialize HP values properly for enemy team
        for pokemon in enemy_team:
            pokemon['max_hp'] = pokemon['hp']  # Set max HP to original HP
            pokemon['current_hp'] = pokemon['hp']  # Set current HP to max initially
        
        # Initialize battle state with proper field names
        battle_state = {
            'player_team': player_team,
            'enemy_team': enemy_team,
            'current_player_index': 0,
            'current_enemy_index': 0,
            'player_pokemon': player_team[0],
            'enemy_pokemon': enemy_team[0],
            'turn': 1,
            'battle_log': [f"A wild {enemy_team[0]['name']} appeared!"]
        }
        
        session['battle_state'] = battle_state
        return jsonify({
            'player_pokemon': battle_state['player_pokemon'],
            'enemy_pokemon': battle_state['enemy_pokemon'],
            'player_team': battle_state['player_team'],
            'enemy_team': battle_state['enemy_team'],
            'current_player_index': battle_state['current_player_index'],
            'current_enemy_index': battle_state['current_enemy_index'],
            'battle_log': battle_state['battle_log']
        })

    @app.route('/api/battle/use-move', methods=['POST'])
    def use_move():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = session.get('battle_state')
        if not battle_state:
            return jsonify({'error': 'No active battle'}), 400
        
        data = request.json
        move_index = data.get('move_index', 0)
        
        player_pokemon = battle_state['player_pokemon']
        enemy_pokemon = battle_state['enemy_pokemon']
        
        # Get move name from database moves
        moves = player_pokemon.get('moves', ['Tackle', 'Growl', 'Scratch', 'Leer'])
        if move_index >= len(moves):
            return jsonify({'error': 'Invalid move'}), 400
        
        selected_move = moves[move_index]
        
        # Calculate damage based on Pokemon stats
        player_damage = calculate_damage(player_pokemon, enemy_pokemon, selected_move)
        enemy_pokemon['current_hp'] = max(0, enemy_pokemon['current_hp'] - player_damage)
        
        # Update enemy team array to reflect the damage
        battle_state['enemy_team'][battle_state['current_enemy_index']] = enemy_pokemon
        
        battle_state['battle_log'].append(f"{player_pokemon['name']} used {selected_move}!")
        battle_state['battle_log'].append(f"It dealt {player_damage} damage!")
        
        # Check if enemy fainted
        if enemy_pokemon['current_hp'] <= 0:
            battle_state['battle_log'].append(f"{enemy_pokemon['name']} fainted!")
            
            # Check if enemy has more Pokemon
            if battle_state['current_enemy_index'] < len(battle_state['enemy_team']) - 1:
                # Enemy switches to next Pokemon
                battle_state['current_enemy_index'] += 1
                new_enemy = battle_state['enemy_team'][battle_state['current_enemy_index']]
                battle_state['enemy_pokemon'] = new_enemy
                battle_state['battle_log'].append(f"Enemy sent out {new_enemy['name']}!")
                
                # Enemy gets a free turn
                enemy_moves = new_enemy.get('moves', ['Tackle', 'Growl', 'Scratch', 'Leer'])
                enemy_move = random.choice(enemy_moves)
                enemy_damage = calculate_damage(new_enemy, player_pokemon, enemy_move)
                player_pokemon['current_hp'] = max(0, player_pokemon['current_hp'] - enemy_damage)
                
                # Update player team array to reflect the damage
                battle_state['player_team'][battle_state['current_player_index']] = player_pokemon
                
                battle_state['battle_log'].append(f"{new_enemy['name']} used {enemy_move}!")
                battle_state['battle_log'].append(f"It dealt {enemy_damage} damage!")
                
                # Check if player fainted after enemy attack
                if player_pokemon['current_hp'] <= 0:
                    battle_state['battle_log'].append(f"{player_pokemon['name']} fainted!")
                    # Check if player has more Pokemon
                    if battle_state['current_player_index'] < len(battle_state['player_team']) - 1:
                        battle_state['battle_log'].append("Choose your next Pokemon!")
                        session['battle_state'] = battle_state
                        battle_state = sync_battle_state(battle_state)
                        return jsonify({
                            'player_pokemon': battle_state['player_pokemon'],
                            'enemy_pokemon': battle_state['enemy_pokemon'],
                            'player_team': battle_state['player_team'],
                            'enemy_team': battle_state['enemy_team'],
                            'current_player_index': battle_state['current_player_index'],
                            'current_enemy_index': battle_state['current_enemy_index'],
                            'battle_log': battle_state['battle_log'],
                            'battle_ended': False,
                            'turn': battle_state['turn']
                        })
                    else:
                        battle_state['battle_log'].append("You lost the battle!")
                        session['battle_state'] = battle_state
                        battle_state = sync_battle_state(battle_state)
                        return jsonify({
                            'player_pokemon': battle_state['player_pokemon'],
                            'enemy_pokemon': battle_state['enemy_pokemon'],
                            'player_team': battle_state['player_team'],
                            'enemy_team': battle_state['enemy_team'],
                            'current_player_index': battle_state['current_player_index'],
                            'current_enemy_index': battle_state['current_enemy_index'],
                            'battle_log': battle_state['battle_log'],
                            'battle_ended': True,
                            'winner': 'enemy',
                            'turn': battle_state['turn']
                        })
            else:
                # Enemy has no more Pokemon
                battle_state['battle_log'].append("You won the battle!")
                session['battle_state'] = battle_state
                battle_state = sync_battle_state(battle_state)
                return jsonify({
                    'player_pokemon': battle_state['player_pokemon'],
                    'enemy_pokemon': battle_state['enemy_pokemon'],
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_state['battle_log'],
                    'battle_ended': True,
                    'winner': 'player',
                    'turn': battle_state['turn']
                })
        
        # Enemy turn (if not already handled above)
        enemy_moves = enemy_pokemon.get('moves', ['Tackle', 'Growl', 'Scratch', 'Leer'])
        enemy_move = random.choice(enemy_moves)
        enemy_damage = calculate_damage(enemy_pokemon, player_pokemon, enemy_move)
        player_pokemon['current_hp'] = max(0, player_pokemon['current_hp'] - enemy_damage)
        
        # Update player team array to reflect the damage
        battle_state['player_team'][battle_state['current_player_index']] = player_pokemon
        
        battle_state['battle_log'].append(f"{enemy_pokemon['name']} used {enemy_move}!")
        battle_state['battle_log'].append(f"It dealt {enemy_damage} damage!")
        
        # Check if player fainted
        if player_pokemon['current_hp'] <= 0:
            battle_state['battle_log'].append(f"{player_pokemon['name']} fainted!")
            # Check if player has more Pokemon
            if battle_state['current_player_index'] < len(battle_state['player_team']) - 1:
                battle_state['battle_log'].append("Choose your next Pokemon!")
                session['battle_state'] = battle_state
                battle_state = sync_battle_state(battle_state)
                return jsonify({
                    'player_pokemon': battle_state['player_pokemon'],
                    'enemy_pokemon': battle_state['enemy_pokemon'],
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_state['battle_log'],
                    'battle_ended': False,
                    'turn': battle_state['turn']
                })
            else:
                battle_state['battle_log'].append("You lost the battle!")
                session['battle_state'] = battle_state
                battle_state = sync_battle_state(battle_state)
                return jsonify({
                    'player_pokemon': battle_state['player_pokemon'],
                    'enemy_pokemon': battle_state['enemy_pokemon'],
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_state['battle_log'],
                    'battle_ended': True,
                    'winner': 'enemy',
                    'turn': battle_state['turn']
                })
        
        battle_state['turn'] += 1
        session['battle_state'] = battle_state
        
        # Ensure battle state is synchronized before returning
        battle_state = sync_battle_state(battle_state)
        
        return jsonify({
            'player_pokemon': battle_state['player_pokemon'],
            'enemy_pokemon': battle_state['enemy_pokemon'],
            'player_team': battle_state['player_team'],
            'enemy_team': battle_state['enemy_team'],
            'current_player_index': battle_state['current_player_index'],
            'current_enemy_index': battle_state['current_enemy_index'],
            'battle_log': battle_state['battle_log'],
            'battle_ended': False,
            'turn': battle_state['turn']
        })

    @app.route('/api/battle/switch-pokemon', methods=['POST'])
    def switch_pokemon():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = session.get('battle_state')
        if not battle_state:
            return jsonify({'error': 'No active battle'}), 400
        
        data = request.json
        pokemon_index = data.get('pokemon_index', 0)
        
        if pokemon_index >= len(battle_state['player_team']):
            return jsonify({'error': 'Invalid Pokemon index'}), 400
        
        new_pokemon = battle_state['player_team'][pokemon_index]
        if new_pokemon['current_hp'] <= 0:
            return jsonify({'error': 'Pokemon is fainted'}), 400
        
        if pokemon_index == battle_state['current_player_index']:
            return jsonify({'error': 'Pokemon is already active'}), 400
        
        # Switch Pokemon
        battle_state['current_player_index'] = pokemon_index
        battle_state['player_pokemon'] = new_pokemon
        battle_state['battle_log'].append(f"Go! {new_pokemon['name']}!")
        
        # Enemy gets a free turn
        enemy_pokemon = battle_state['enemy_pokemon']
        enemy_moves = enemy_pokemon.get('moves', ['Tackle', 'Growl', 'Scratch', 'Leer'])
        enemy_move = random.choice(enemy_moves)
        enemy_damage = calculate_damage(enemy_pokemon, new_pokemon, enemy_move)
        new_pokemon['current_hp'] = max(0, new_pokemon['current_hp'] - enemy_damage)
        
        # Update player team array to reflect the damage
        battle_state['player_team'][battle_state['current_player_index']] = new_pokemon
        
        battle_state['battle_log'].append(f"{enemy_pokemon['name']} used {enemy_move}!")
        battle_state['battle_log'].append(f"It dealt {enemy_damage} damage!")
        
        # Check if player fainted after switch
        if new_pokemon['current_hp'] <= 0:
            battle_state['battle_log'].append(f"{new_pokemon['name']} fainted!")
            # Check if player has more Pokemon
            if battle_state['current_player_index'] < len(battle_state['player_team']) - 1:
                battle_state['battle_log'].append("Choose your next Pokemon!")
                session['battle_state'] = battle_state
                battle_state = sync_battle_state(battle_state)
                return jsonify({
                    'player_pokemon': new_pokemon,
                    'enemy_pokemon': enemy_pokemon,
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_state['battle_log'],
                    'battle_ended': False,
                    'turn': battle_state['turn']
                })
            else:
                battle_state['battle_log'].append("You lost the battle!")
                session['battle_state'] = battle_state
                battle_state = sync_battle_state(battle_state)
                return jsonify({
                    'player_pokemon': new_pokemon,
                    'enemy_pokemon': enemy_pokemon,
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_state['battle_log'],
                    'battle_ended': True,
                    'winner': 'enemy',
                    'turn': battle_state['turn']
                })
        
        session['battle_state'] = battle_state
        
        # Ensure battle state is synchronized before returning
        battle_state = sync_battle_state(battle_state)
        
        return jsonify({
            'player_pokemon': battle_state['player_pokemon'],
            'enemy_pokemon': battle_state['enemy_pokemon'],
            'player_team': battle_state['player_team'],
            'enemy_team': battle_state['enemy_team'],
            'current_player_index': battle_state['current_player_index'],
            'current_enemy_index': battle_state['current_enemy_index'],
            'battle_log': battle_state['battle_log'],
            'battle_ended': False,
            'turn': battle_state['turn']
        })

    @app.route('/api/battle/state')
    def get_battle_state():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = session.get('battle_state')
        if not battle_state:
            return jsonify({'error': 'No active battle'}), 400
        
        return jsonify({
            'player_pokemon': battle_state['player_pokemon'],
            'enemy_pokemon': battle_state['enemy_pokemon'],
            'player_team': battle_state['player_team'],
            'enemy_team': battle_state['enemy_team'],
            'current_player_index': battle_state['current_player_index'],
            'current_enemy_index': battle_state['current_enemy_index'],
            'battle_log': battle_state['battle_log'],
            'turn': battle_state['turn']
        })

    @app.route('/api/battle/end', methods=['POST'])
    def end_battle():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        session.pop('battle_state', None)
        return jsonify({'success': True})

    @app.route('/api/battle/random-pokemon')
    def get_random_pokemon():
        try:
            # Get random Pokemon from database
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Get total count of Pokemon
            cur.execute("SELECT COUNT(*) FROM Pokemon")
            total_pokemon = cur.fetchone()[0]
            
            # Generate random Pokemon IDs
            player_pokemon_id = random.randint(1, min(total_pokemon, 1000))  # Limit to first 1000 for now
            enemy_pokemon_id = random.randint(1, min(total_pokemon, 1000))
            
            # Get player Pokemon
            cur.execute("""
                SELECT p.pokemon_id, p.name, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
                FROM Pokemon p WHERE p.pokemon_id = ?
            """, (player_pokemon_id,))
            player_data = cur.fetchone()
            
            # Get enemy Pokemon
            cur.execute("""
                SELECT p.pokemon_id, p.name, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
                FROM Pokemon p WHERE p.pokemon_id = ?
            """, (enemy_pokemon_id,))
            enemy_data = cur.fetchone()
            
            if not player_data or not enemy_data:
                conn.close()
                return jsonify({'success': False, 'error': 'Pokemon not found'})
            
            # Get moves for player Pokemon
            cur.execute("""
                SELECT m.move_name FROM PokemonHasMove phm
                JOIN Move m ON phm.move_id = m.move_id
                WHERE phm.pokemon_id = ? ORDER BY RANDOM() LIMIT 4
            """, (player_pokemon_id,))
            player_moves = [row[0] for row in cur.fetchall()]
            
            # Get moves for enemy Pokemon
            cur.execute("""
                SELECT m.move_name FROM PokemonHasMove phm
                JOIN Move m ON phm.move_id = m.move_id
                WHERE phm.pokemon_id = ? ORDER BY RANDOM() LIMIT 4
            """, (enemy_pokemon_id,))
            enemy_moves = [row[0] for row in cur.fetchall()]
            
            # Generate additional Pokemon for player team
            team_pokemon_ids = [player_pokemon_id]
            for _ in range(3):  # Add 3 more Pokemon to team
                team_id = random.randint(1, min(total_pokemon, 1000))
                if team_id not in team_pokemon_ids:
                    team_pokemon_ids.append(team_id)
            
            # Get team Pokemon data
            team_pokemon = []
            for pokemon_id in team_pokemon_ids:
                cur.execute("""
                    SELECT p.pokemon_id, p.name, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
                    FROM Pokemon p WHERE p.pokemon_id = ?
                """, (pokemon_id,))
                pokemon_data = cur.fetchone()
                if pokemon_data:
                    # Get moves for this Pokemon
                    cur.execute("""
                        SELECT m.move_name FROM PokemonHasMove phm
                        JOIN Move m ON phm.move_id = m.move_id
                        WHERE phm.pokemon_id = ? ORDER BY RANDOM() LIMIT 4
                    """, (pokemon_id,))
                    moves = [row[0] for row in cur.fetchall()]
                    
                    team_pokemon.append({
                        'id': pokemon_data[0],
                        'name': pokemon_data[1],
                        'hp': pokemon_data[2] * 2,  # Scale HP for battle
                        'maxHp': pokemon_data[2] * 2,
                        'level': 50,
                        'moves': moves
                    })
            
            conn.close()
            
            return jsonify({
                'success': True,
                'playerPokemon': {
                    'id': player_data[0],
                    'name': player_data[1],
                    'hp': player_data[2] * 2,
                    'maxHp': player_data[2] * 2,
                    'level': 50,
                    'moves': player_moves
                },
                'enemyPokemon': {
                    'id': enemy_data[0],
                    'name': enemy_data[1],
                    'hp': enemy_data[2] * 2,
                    'maxHp': enemy_data[2] * 2,
                    'level': 50,
                    'moves': enemy_moves
                },
                'playerTeam': team_pokemon
            })
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})

def calculate_damage(attacker, defender, move_name):
    """Calculate damage based on Pokemon stats and move"""
    # Simple damage calculation
    base_damage = 20
    attack_stat = attacker.get('atk', 50)
    defense_stat = defender.get('def', 50)
    
    # Damage formula: (attack_stat / defense_stat) * base_damage + random variation
    damage = int((attack_stat / max(defense_stat, 1)) * base_damage)
    damage = max(1, damage + random.randint(-5, 5))  # Add some randomness
    
    return damage

def sync_battle_state(battle_state):
    """Ensure battle state is properly synchronized"""
    # Sync player_pokemon with player_team
    if battle_state['player_team'] and battle_state['current_player_index'] < len(battle_state['player_team']):
        battle_state['player_pokemon'] = battle_state['player_team'][battle_state['current_player_index']]
    
    # Sync enemy_pokemon with enemy_team
    if battle_state['enemy_team'] and battle_state['current_enemy_index'] < len(battle_state['enemy_team']):
        battle_state['enemy_pokemon'] = battle_state['enemy_team'][battle_state['current_enemy_index']]
    
    return battle_state