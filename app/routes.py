from flask import render_template, request, jsonify, session, Response, abort, make_response, redirect, url_for
from app.db import fetch_pokemon, fetch_pokemon_by_id, get_db_connection, save_team as db_save_team, get_team as db_get_team, list_teams, get_team_by_id, save_team_by_id, create_team, get_move_data, get_type_effectiveness, get_pokemon_full_data
#from app.mongo_client import get_player_profiles_collection, get_teams_collection
import bcrypt
from datetime import datetime
import sqlite3
import random
from app.mongo_client import get_battles_collection
import math


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
        
        # Get team_id from query parameter, default to None
        team_id = request.args.get('team_id', type=int)
        return render_template('battle.html', team_id=team_id)

    @app.route('/api/battle/start', methods=['POST'])
    def start_battle():
        from app.db import get_pokemon_full_data
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.json
        team_id = data.get('team_id')  # Get the team_id from the request
        
        # Get user's team based on team_id
        if team_id:
            # Use the specific team requested
            player_team_ids = get_team_by_id(team_id)
        else:
            # Fallback to default team if no team_id provided
            player_team_ids = db_get_team(int(user['_id']))
        
        if not player_team_ids:
            # Create a default team if user doesn't have one
            default_pokemon_ids = [25, 6, 9]  # Pikachu, Charizard, Blastoise
            player_team = [fetch_pokemon_by_id(pid) for pid in default_pokemon_ids]
        else:
            player_team = [fetch_pokemon_by_id(pid) for pid in player_team_ids]
        
        if not player_team:
            return jsonify({'error': 'Invalid team'}), 400
        
        # Generate enemy team of 3 Pokemon
        enemy_team = []
        for _ in range(3):
            enemy_pokemon = fetch_pokemon_by_id(random.randint(1, 1025))  # Gen 1 Pokemon
            enemy_team.append(enemy_pokemon)
        
        # Assign randomized moves to each Pokémon
        def assign_random_moves(pokemon):
            # Get full Pokémon data including all available moves
            full_data = get_pokemon_full_data(pokemon['id'] if 'id' in pokemon else pokemon['pokemon_id'])
            if not full_data or not full_data['move_ids']:
                # Fallback to default moves if no moves available
                pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
                print(f"DEBUG: {pokemon['name']} has no moves, using defaults: {pokemon['assigned_moves']}")
                return pokemon
            
            # Filter out invalid move IDs (those that don't exist in Move table)
            valid_moves = []
            for move_id in full_data['move_ids']:
                move_data = get_move_data(move_id)
                if move_data:
                    valid_moves.append(move_id)
                else:
                    print(f"DEBUG: Invalid move_id {move_id} for {pokemon['name']}")
            
            if not valid_moves:
                # If no valid moves, use some basic moves
                pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
                print(f"DEBUG: {pokemon['name']} has no valid moves, using defaults: {pokemon['assigned_moves']}")
                return pokemon
            
            # Randomly select 4 moves from available moves
            if len(valid_moves) <= 4:
                selected_moves = valid_moves
            else:
                selected_moves = random.sample(valid_moves, 4)
            
            pokemon['assigned_moves'] = selected_moves
            print(f"DEBUG: {pokemon['name']} assigned moves: {selected_moves}")
            return pokemon
        
        # Assign moves to player team
        for pokemon in player_team:
            pokemon = assign_random_moves(pokemon)
            pokemon['max_hp'] = pokemon['hp']  # Set max HP to original HP
            pokemon['current_hp'] = pokemon['hp']  # Set current HP to max initially
        
        # Assign moves to enemy team
        for pokemon in enemy_team:
            pokemon = assign_random_moves(pokemon)
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
        save_battle_state_to_db(user['_id'], battle_state)
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
        from app.db import get_pokemon_full_data, get_move_data
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = get_battle_state_from_db(user['_id'])
        if not battle_state:
            return jsonify({'error': 'No active battle'}), 400
        
        data = request.json
        move_index = data.get('move_index', 0)
        
        # Get current Pokemon references
        player_pokemon = battle_state['player_team'][battle_state['current_player_index']]
        enemy_pokemon = battle_state['enemy_team'][battle_state['current_enemy_index']]
        
        # Fetch full data for both
        player_full = get_pokemon_full_data(player_pokemon['id'] if 'id' in player_pokemon else player_pokemon['pokemon_id'])
        enemy_full = get_pokemon_full_data(enemy_pokemon['id'] if 'id' in enemy_pokemon else enemy_pokemon['pokemon_id'])
        if not player_full or not enemy_full:
            return jsonify({'error': 'Could not fetch Pokémon data'}), 400
        
        # Get move_id for player's selected move
        player_assigned_moves = player_pokemon['assigned_moves']
        if move_index >= len(player_assigned_moves):
            return jsonify({'error': 'Invalid move'}), 400
        player_move_id = player_assigned_moves[move_index]
        player_move = get_move_data(player_move_id)
        if not player_move:
            return jsonify({'error': 'Invalid move data'}), 400
        
        # Enemy selects a random move from their assigned moves
        enemy_assigned_moves = enemy_pokemon['assigned_moves']
        if not enemy_assigned_moves:
            return jsonify({'error': 'Enemy has no moves'}), 400
        import random
        enemy_move_id = random.choice(enemy_assigned_moves)
        enemy_move = get_move_data(enemy_move_id)
        if not enemy_move:
            return jsonify({'error': 'Enemy move data error'}), 400
        
        # Determine turn order by move priority first, then speed as tiebreaker
        player_move_priority = player_move['priority']
        enemy_move_priority = enemy_move['priority']
        
        if player_move_priority > enemy_move_priority:
            turn_order = ['player', 'enemy']
        elif enemy_move_priority > player_move_priority:
            turn_order = ['enemy', 'player']
        else:
            # Same priority, use speed as tiebreaker
            player_speed = player_full['speed']
            enemy_speed = enemy_full['speed']
            if player_speed > enemy_speed:
                turn_order = ['player', 'enemy']
            elif enemy_speed > player_speed:
                turn_order = ['enemy', 'player']
            else:
                turn_order = random.sample(['player', 'enemy'], 2)
        
        # Prepare log
        battle_log = battle_state['battle_log']
        battle_log.append(f"Turn {battle_state['turn']}: {player_full['name']} (You) vs {enemy_full['name']} (Enemy)")
        
        # Store HP before turn
        player_hp = player_pokemon['current_hp']
        enemy_hp = enemy_pokemon['current_hp']
        
        # Execute turns
        for actor in turn_order:
            if actor == 'player' and player_hp > 0:
                dmg, crit, hit, eff, log_details = calculate_damage_advanced(player_full, enemy_full, player_move_id)
                if hit:
                    enemy_hp = max(0, enemy_hp - dmg)
                battle_log.append(f"You used {player_move['move_name']}! {log_details}")
                if not hit:
                    battle_log.append(f"{player_full['name']}'s attack missed!")
                if crit:
                    battle_log.append("Critical hit!")
                if eff > 1.0:
                    battle_log.append("It's super effective!")
                elif eff < 1.0:
                    battle_log.append("It's not very effective...")
                if enemy_hp <= 0:
                    battle_log.append(f"Enemy {enemy_full['name']} fainted!")
                    break
            elif actor == 'enemy' and enemy_hp > 0:
                dmg, crit, hit, eff, log_details = calculate_damage_advanced(enemy_full, player_full, enemy_move_id)
                if hit:
                    player_hp = max(0, player_hp - dmg)
                battle_log.append(f"Enemy used {enemy_move['move_name']}! {log_details}")
                if not hit:
                    battle_log.append(f"Enemy {enemy_full['name']}'s attack missed!")
                if crit:
                    battle_log.append("Critical hit!")
                if eff > 1.0:
                    battle_log.append("It's super effective!")
                elif eff < 1.0:
                    battle_log.append("It's not very effective...")
                if player_hp <= 0:
                    battle_log.append(f"Your {player_full['name']} fainted!")
                    break
        
        # Update HP in state
        battle_state['player_team'][battle_state['current_player_index']]['current_hp'] = player_hp
        battle_state['enemy_team'][battle_state['current_enemy_index']]['current_hp'] = enemy_hp
        battle_state['player_pokemon'] = battle_state['player_team'][battle_state['current_player_index']]
        battle_state['enemy_pokemon'] = battle_state['enemy_team'][battle_state['current_enemy_index']]
        
        # Handle fainting and win/loss
        if enemy_hp <= 0:
            # Enemy fainted
            if battle_state['current_enemy_index'] < len(battle_state['enemy_team']) - 1:
                battle_state['current_enemy_index'] += 1
                new_enemy = battle_state['enemy_team'][battle_state['current_enemy_index']]
                battle_state['enemy_pokemon'] = new_enemy
                battle_log.append(f"Enemy sent out {new_enemy['name']}!")
            else:
                battle_log.append("You won the battle!")
                save_battle_state_to_db(user['_id'], battle_state)
                return jsonify({
                    'player_pokemon': battle_state['player_pokemon'],
                    'enemy_pokemon': battle_state['enemy_pokemon'],
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_log,
                    'battle_ended': True,
                    'winner': 'player',
                    'turn': battle_state['turn']
                })
        if player_hp <= 0:
            # Player fainted
            alive_pokemon = [p for p in battle_state['player_team'] if p['current_hp'] > 0]
            if alive_pokemon:
                battle_log.append("Choose your next Pokemon!")
                save_battle_state_to_db(user['_id'], battle_state)
                return jsonify({
                    'player_pokemon': battle_state['player_pokemon'],
                    'enemy_pokemon': battle_state['enemy_pokemon'],
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_log,
                    'battle_ended': False,
                    'turn': battle_state['turn']
                })
            else:
                battle_log.append("You lost the battle!")
                save_battle_state_to_db(user['_id'], battle_state)
                return jsonify({
                    'player_pokemon': battle_state['player_pokemon'],
                    'enemy_pokemon': battle_state['enemy_pokemon'],
                    'player_team': battle_state['player_team'],
                    'enemy_team': battle_state['enemy_team'],
                    'current_player_index': battle_state['current_player_index'],
                    'current_enemy_index': battle_state['current_enemy_index'],
                    'battle_log': battle_log,
                    'battle_ended': True,
                    'winner': 'enemy',
                    'turn': battle_state['turn']
                })
        # Continue battle
        battle_state['turn'] += 1
        save_battle_state_to_db(user['_id'], battle_state)
        return jsonify({
            'player_pokemon': battle_state['player_pokemon'],
            'enemy_pokemon': battle_state['enemy_pokemon'],
            'player_team': battle_state['player_team'],
            'enemy_team': battle_state['enemy_team'],
            'current_player_index': battle_state['current_player_index'],
            'current_enemy_index': battle_state['current_enemy_index'],
            'battle_log': battle_log,
            'battle_ended': False,
            'turn': battle_state['turn']
        })

    @app.route('/api/battle/switch-pokemon', methods=['POST'])
    def switch_pokemon():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = get_battle_state_from_db(user['_id'])
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
        enemy_pokemon = battle_state['enemy_team'][battle_state['current_enemy_index']]
        enemy_moves = enemy_pokemon.get('moves', ['Tackle', 'Growl', 'Scratch', 'Leer'])
        enemy_move = random.choice(enemy_moves)
        enemy_damage = calculate_damage(enemy_pokemon, new_pokemon, enemy_move)
        new_pokemon['current_hp'] = max(0, new_pokemon['current_hp'] - enemy_damage)
        battle_state['player_team'][battle_state['current_player_index']]['current_hp'] = new_pokemon['current_hp']
        
        battle_state['battle_log'].append(f"{enemy_pokemon['name']} used {enemy_move}!")
        battle_state['battle_log'].append(f"It dealt {enemy_damage} damage!")
        
        # Check if player fainted after switch
        if new_pokemon['current_hp'] <= 0:
            battle_state['battle_log'].append(f"{new_pokemon['name']} fainted!")
            # Check if ANY Pokemon in the team is still alive
            alive_pokemon = [p for p in battle_state['player_team'] if p['current_hp'] > 0]
            if alive_pokemon:
                battle_state['battle_log'].append("Choose your next Pokemon!")
                save_battle_state_to_db(user['_id'], battle_state)
                battle_state['player_pokemon'] = battle_state['player_team'][battle_state['current_player_index']]
                battle_state['enemy_pokemon'] = battle_state['enemy_team'][battle_state['current_enemy_index']]
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
                save_battle_state_to_db(user['_id'], battle_state)
                battle_state['player_pokemon'] = battle_state['player_team'][battle_state['current_player_index']]
                battle_state['enemy_pokemon'] = battle_state['enemy_team'][battle_state['current_enemy_index']]
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
        
        save_battle_state_to_db(user['_id'], battle_state)
        
        battle_state['player_pokemon'] = battle_state['player_team'][battle_state['current_player_index']]
        battle_state['enemy_pokemon'] = battle_state['enemy_team'][battle_state['current_enemy_index']]
        
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

    @app.route('/api/battle/state')
    def get_battle_state():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = get_battle_state_from_db(user['_id'])
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
        
        save_battle_state_to_db(user['_id'], None)
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

    @app.route('/api/pokemon/<int:pokemon_id>/moves')
    def get_pokemon_moves(pokemon_id):
        """Get the moves for a specific Pokémon"""
        from app.db import get_pokemon_full_data
        
        pokemon_data = get_pokemon_full_data(pokemon_id)
        if not pokemon_data:
            return jsonify({'error': 'Pokémon not found'}), 404
        
        # Get move names for the move_ids
        move_names = []
        for move_id in pokemon_data['move_ids']:
            move_data = get_move_data(move_id)
            if move_data:
                move_names.append(move_data['move_name'])
        
        return jsonify({'moves': move_names})

    @app.route('/api/move/<int:move_id>')
    def get_move_by_id(move_id):
        """Get move data by move ID"""
        from app.db import get_move_data
        
        move_data = get_move_data(move_id)
        if not move_data:
            return jsonify({'error': 'Move not found'}), 404
        
        return jsonify(move_data)

def calculate_damage(attacker, defender, move_name):
    """Calculate damage based on Pokemon stats and move"""
    base_damage = 20
    attack_stat = attacker.get('atk', 50)
    defense_stat = defender.get('def', 50)
    
    # Damage formula: (attack_stat / defense_stat) * base_damage + random variation
    damage = int((attack_stat / max(defense_stat, 1)) * base_damage)
    damage = max(1, damage + random.randint(-5, 5))  # Add some randomness
    
    return damage

def calculate_damage_advanced(attacker, defender, move_id, level=50):
    """
    Advanced damage calculation using real Pokémon formula with move categories.
    Returns (damage, critical_hit, hit, effectiveness, log_details)
    """
    from app.db import get_move_data, get_type_effectiveness
    
    move_data = get_move_data(move_id)
    if not move_data:
        return 0, False, False, 1.0, "Invalid move"
    
    # Get move properties
    move_power = move_data['power']
    move_accuracy = move_data['accuracy']
    move_type = move_data['type_id']
    move_category = move_data['category']
    
    # Determine attack and defense stats based on move category
    if move_category == 'physical':
        attack_stat = attacker['atk']
        defense_stat = defender['def']
        attack_name = 'Attack'
        defense_name = 'Defense'
    else:  # special
        attack_stat = attacker['sp_atk']
        defense_stat = defender['sp_def']
        attack_name = 'Special Attack'
        defense_name = 'Special Defense'
    
    # Check accuracy
    if move_accuracy > 0:
        import random
        if random.randint(1, 100) > move_accuracy:
            return 0, False, False, 1.0, f"Move missed (accuracy: {move_accuracy}%)"
    
    # Calculate type effectiveness
    effectiveness = get_type_effectiveness(move_type, defender['types'])
    
    # Check for STAB (Same Type Attack Bonus)
    stab = 1.5 if move_type in attacker['types'] else 1.0
    
    # Critical hit calculation (6.25% chance)
    import random
    critical_hit = random.randint(1, 100) <= 6.25
    crit_multiplier = 2.0 if critical_hit else 1.0
    
    # Random factor (0.85 to 1.00)
    random_factor = random.uniform(0.85, 1.00)
    
    # Calculate damage using the real Pokémon formula
    if move_power > 0:
        damage = int(((2 * level / 5 + 2) * move_power * attack_stat / defense_stat) / 50 + 2)
        damage = int(damage * effectiveness * stab * crit_multiplier * random_factor)
    else:
        damage = 0
    
    log_details = f"Power: {move_power}, {attack_name}: {attack_stat}, {defense_name}: {defense_stat}, Effectiveness: {effectiveness:.2f}x, STAB: {stab:.1f}x"
    
    return damage, critical_hit, True, effectiveness, log_details

# Helper to get battle state from MongoDB

def get_battle_state_from_db(user_id):
    battles = get_battles_collection()
    battle = battles.find_one({'user_id': user_id})
    return battle['state'] if battle else None

def save_battle_state_to_db(user_id, state):
    battles = get_battles_collection()
    battles.update_one({'user_id': user_id}, {'$set': {'state': state}}, upsert=True)