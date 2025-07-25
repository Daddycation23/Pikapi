from flask import render_template, request, jsonify, session, abort, make_response, redirect, url_for
from app.db import fetch_pokemon, fetch_pokemon_by_id, get_db_connection, save_team as db_save_team, get_team as db_get_team, list_teams, get_team_by_id, save_team_by_id, create_team, get_move_data, get_type_effectiveness, get_pokemon_full_data
from datetime import datetime
import random
import json
from app.mongo_client import (
    get_player_profiles_collection, 
    get_battles_collection,
    get_battle_logs_collection,
    get_or_create_player_profile,
    update_player_profile,
    get_player_level_info,
    increment_player_level,
    reset_player_to_level_one
)
import bcrypt

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
        user = get_current_user()
        has_existing_battle = False
        
        # Check if user has an existing battle state
        if user:
            existing_battle = get_battle_state_from_db(user['_id'])
            has_existing_battle = bool(existing_battle)
        
        return render_template('player.html', has_existing_battle=has_existing_battle)

    @app.route('/profile')
    def profile_page():
        user_id = session.get('user_id')
        username = session.get('username')
        if not user_id or not username:
            return redirect(url_for('home'))
        return render_template('profile.html')

    @app.route('/edit_team')
    def edit_team():
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
            'costs': request.args.get('costs', ''),
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
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
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
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
        data = request.json
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
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
            player_id = cur.lastrowid
            conn.commit()

        # Create player profile with new enemy team
        enemy_team = generate_enemy_team_with_moves(1)  # Start at level 1
        get_or_create_player_profile(str(player_id))  # This will create the profile with defaults
        update_player_profile(str(player_id), {
            'current_enemy_team': enemy_team,
            'statistics.total_wins': 0,
            'statistics.total_losses': 0,
            'statistics.team_usage': None,
            'statistics.pokemon_usage': None
        })

        return jsonify({'success': True})

    @app.route('/api/login', methods=['POST'])
    def login():
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
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
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
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

    @app.route('/api/current-challenge')
    def get_current_challenge():
        """Get current enemy team and level information for team building screen"""
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Get level info
        level_info = get_player_level_info(user['_id'])
        # Always generate enemy team for the current level
        enemy_team = get_or_generate_enemy_team(user['_id'])
        # Calculate enemy team cost for the current level
        enemy_cost = 0
        if enemy_team:
            for pokemon in enemy_team:
                if pokemon and pokemon.get('cost'):
                    enemy_cost += pokemon['cost']
        return jsonify({
            'level_info': level_info,
            'enemy_team': enemy_team,
            'enemy_cost': enemy_cost
        })

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
        
        # Get team_id and action from query parameters
        team_id = request.args.get('team_id', type=int)
        action = request.args.get('action', '')
        
        # Check if there's an existing battle state
        existing_battle = get_battle_state_from_db(user['_id'])
        
        # Handle action parameter
        if action == 'new' and existing_battle:
            # Clear existing battle state to start fresh
            save_battle_state_to_db(user['_id'], None)
            existing_battle = None
        
        return render_template('battle.html', team_id=team_id, has_existing_battle=bool(existing_battle), action=action)

    @app.route('/api/battle/start', methods=['POST'])
    def start_battle():
        from app.db import get_pokemon_full_data
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
        data = request.json
        team_id = data.get('team_id')  # Get the team_id from the request
        
        # Get current player level and enemy team
        level_info = get_player_level_info(user['_id'])
        player_level = level_info['current_level']
        enemy_team = get_or_generate_enemy_team(user['_id'])
        
        # Get user's team based on team_id
        if team_id:
            # Use the specific team requested
            player_team_ids = get_team_by_id(team_id)
        else:
            # Fallback to default team if no team_id provided
            player_team_ids = db_get_team(int(user['_id']))
        
        if not player_team_ids:
            # Return error if no team is available
            return jsonify({'error': 'No team available. Please create a team with at least 1 Pokemon before starting a battle.'}), 400
        
        player_team = [fetch_pokemon_by_id(pid) for pid in player_team_ids]
        
        if not player_team:
            return jsonify({'error': 'Invalid team'}), 400
        
        # Use pre-generated enemy team (already has moves assigned)
        if not enemy_team:
            return jsonify({'error': 'No enemy team available'}), 400
        
        # Assign randomized moves to each Pokémon
        def assign_random_moves(pokemon):
            # Get full Pokémon data including all available moves
            # Handle both 'id' and 'pokemon_id' fields
            pokemon_id = pokemon.get('id') or pokemon.get('pokemon_id')
            if not pokemon_id:
                print(f"DEBUG: No valid ID found for {pokemon.get('name', 'Unknown')}")
                pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
                return pokemon
                
            full_data = get_pokemon_full_data(pokemon_id)
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
        
        # Apply traditional stats to player team
        for i, pokemon in enumerate(player_team):
            if not pokemon:
                continue
            # Use the Pokémon's level if present, otherwise default to 50
            level = pokemon.get('level', 50)
            pokemon = apply_traditional_stats(pokemon, level)
            pokemon = assign_random_moves(pokemon)
            pokemon['max_hp'] = pokemon['hp']  # Set max HP to original HP
            pokemon['current_hp'] = pokemon['hp']  # Set current HP to max initially
            # Ensure both 'id' and 'pokemon_id' fields are present
            pokemon['id'] = pokemon.get('id') or pokemon.get('pokemon_id')
            pokemon['pokemon_id'] = pokemon['id']
            # Ensure 'name' is present
            pokemon['name'] = pokemon.get('name', 'Unknown')
            # Ensure 'assigned_moves' is a list
            if 'assigned_moves' not in pokemon or not isinstance(pokemon['assigned_moves'], list):
                pokemon['assigned_moves'] = []
            player_team[i] = pokemon
        
        # Enemy team is already pre-generated with moves, just ensure HP is reset
        for i, pokemon in enumerate(enemy_team):
            if pokemon:
                pokemon['current_hp'] = pokemon['max_hp']  # Reset HP to full
                enemy_team[i] = pokemon
        
        # Initialize battle state with proper field names
        battle_state = {
            'player_team': player_team,
            'enemy_team': enemy_team,
            'current_player_index': 0,
            'current_enemy_index': 0,
            'player_pokemon': player_team[0],
            'enemy_pokemon': enemy_team[0],
            'turn': 1,
            'player_level': player_level,
            'level_info': level_info,
            'battle_log': [f"Enemy sent out {enemy_team[0]['name']}!"],
            'team_id': team_id  # <-- Always include team_id

        }
        save_battle_state_to_db(user['_id'], battle_state)
        return jsonify({
            'player_pokemon': battle_state['player_pokemon'],
            'enemy_pokemon': battle_state['enemy_pokemon'],
            'player_team': battle_state['player_team'],
            'enemy_team': battle_state['enemy_team'],
            'current_player_index': battle_state['current_player_index'],
            'current_enemy_index': battle_state['current_enemy_index'],
            'player_level': battle_state['player_level'],
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
        
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
        data = request.json
        move_index = data.get('move_index', 0)
        
        # Get current Pokemon references
        player_pokemon = battle_state['player_team'][battle_state['current_player_index']]
        enemy_pokemon = battle_state['enemy_team'][battle_state['current_enemy_index']]
        
        # Fetch full data for both - handle both 'id' and 'pokemon_id' fields
        player_id = player_pokemon.get('id') or player_pokemon.get('pokemon_id')
        enemy_id = enemy_pokemon.get('id') or enemy_pokemon.get('pokemon_id')
        
        if not player_id or not enemy_id:
            return jsonify({'error': 'Invalid Pokémon IDs'}), 400
            
        player_full = get_pokemon_full_data(player_id)
        enemy_full = get_pokemon_full_data(enemy_id)
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
                battle_log.append(f"You used {player_move['move_name']}! It dealt {dmg} damage. {log_details}")
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
                battle_log.append(f"Enemy used {enemy_move['move_name']}! It dealt {dmg} damage. {log_details}")
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
                # Increment player level on victory and generate new enemy team
                new_level = increment_player_level(user['_id'])
                generate_new_enemy_team_for_level(user['_id'], new_level)
                battle_log.append(f"Level up! You are now level {new_level}!")
                # --- MongoDB stats update for win ---
                profiles = get_player_profiles_collection()
                user_id = user['_id']
                get_or_create_player_profile(str(user_id))
                # Increment total_wins
                profiles.update_one({'_id': str(user_id)}, {'$inc': {'statistics.total_wins': 1}})
                # Get the current team composition as a list of Pokémon IDs
                player_team = battle_state.get('player_team', [])
                team_comp = [poke.get('id') or poke.get('pokemon_id') for poke in player_team]
                team_key = json.dumps(team_comp)  # Use as a string key
                # Increment usage count for this composition
                profiles.update_one({'_id': str(user_id)}, {f'$inc': {f'team_usage.{team_key}': 1}}, upsert=True)
                # Pokémon usage
                for poke_id in team_comp:
                    if poke_id is not None:
                        profiles.update_one({'_id': str(user_id)}, {f'$inc': {f'pokemon_usage.{poke_id}': 1}}, upsert=True)
                # Update most used team and Pokémon
                updated_profile = profiles.find_one({'_id': str(user_id)})
                if updated_profile:
                    team_usage = updated_profile.get('team_usage', {})
                    pokemon_usage = updated_profile.get('pokemon_usage', {})
                else:
                    team_usage = {}
                    pokemon_usage = {}
                most_used_team_key = max(team_usage, key=lambda k: team_usage[k]) if team_usage else None
                most_used_team = json.loads(most_used_team_key) if most_used_team_key else []
                most_used_pokemon_id = max(pokemon_usage, key=lambda k: pokemon_usage[k]) if pokemon_usage else None
                # Always set statistics.most_used_team to the composition (list of IDs)
                profiles.update_one({'_id': str(user_id)}, {'$set': {'statistics.most_used_team': most_used_team, 'statistics.most_used_pokemon_id': int(most_used_pokemon_id) if most_used_pokemon_id else None}})
                # --- end MongoDB stats update ---

                # Clear battle state since battle is complete
                save_battle_state_to_db(user['_id'], None)
                
                # --- Save battle record for win ---
                player_level = battle_state.get('player_level') if battle_state else None
                save_battle_record(user['_id'], 'win', battle_state['player_team'], battle_state['enemy_team'], list(battle_log), player_level)
                # --- end save battle record ---
                
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
                    'new_level': new_level,
                    'redirect_to_team_building': True,
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
                # Reset player to level 1 and generate new enemy team
                reset_level = reset_player_to_level_one(user['_id'])
                generate_new_enemy_team_for_level(user['_id'], reset_level)
                battle_log.append(f"You have been reset to level {reset_level}!")
                
                # --- MongoDB stats update for loss ---
                profiles = get_player_profiles_collection()
                user_id = user['_id']
                get_or_create_player_profile(str(user_id))
                # Get the current team composition as a list of Pokémon IDs
                player_team = battle_state.get('player_team', [])
                team_comp = [poke.get('id') or poke.get('pokemon_id') for poke in player_team]
                team_key = json.dumps(team_comp)  # Use as a string key
                # Increment usage count for this composition
                profiles.update_one({'_id': str(user_id)}, {f'$inc': {f'team_usage.{team_key}': 1}}, upsert=True)
                # Pokémon usage
                for poke_id in team_comp:
                    if poke_id is not None:
                        profiles.update_one({'_id': str(user_id)}, {f'$inc': {f'pokemon_usage.{poke_id}': 1}}, upsert=True)
                # Update most used team and Pokémon
                updated_profile = profiles.find_one({'_id': str(user_id)})
                if updated_profile:
                    team_usage = updated_profile.get('team_usage', {})
                    pokemon_usage = updated_profile.get('pokemon_usage', {})
                else:
                    team_usage = {}
                    pokemon_usage = {}
                most_used_team_key = max(team_usage, key=lambda k: team_usage[k]) if team_usage else None
                most_used_team = json.loads(most_used_team_key) if most_used_team_key else []
                most_used_pokemon_id = max(pokemon_usage, key=lambda k: pokemon_usage[k]) if pokemon_usage else None
                # Always set statistics.most_used_team to the composition (list of IDs)
                profiles.update_one({'_id': str(user_id)}, {'$set': {'statistics.most_used_team': most_used_team, 'statistics.most_used_pokemon_id': int(most_used_pokemon_id) if most_used_pokemon_id else None}})
                # --- end MongoDB stats update ---

                # Clear battle state since battle is complete
                save_battle_state_to_db(user['_id'], None)
                
                # --- Save battle record for loss ---
                player_level = battle_state.get('player_level') if battle_state else None
                save_battle_record(user['_id'], 'loss', battle_state['player_team'], battle_state['enemy_team'], list(battle_log), player_level)
                # --- end save battle record ---
                
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
                    'reset_level': reset_level,
                    'redirect_to_team_building': True,
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
        
        if not request.json:
            return jsonify({'error': 'Invalid JSON data'}), 400
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
                
                # Clear battle state since battle is complete
                save_battle_state_to_db(user['_id'], None)
                
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

    @app.route('/api/battle/restore', methods=['POST'])
    def restore_battle():
        """Restore existing battle state"""
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        battle_state = get_battle_state_from_db(user['_id'])
        if not battle_state:
            return jsonify({'error': 'No battle to restore'}), 404
        
        return jsonify(battle_state)

    @app.route('/api/battle/reset', methods=['POST'])
    def reset_battle():
        """Reset battle state and start fresh"""
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Clear existing battle state
        save_battle_state_to_db(user['_id'], None)
        
        # Start new battle
        return start_battle()

    @app.route('/api/battle/start-fresh', methods=['POST'])
    def start_fresh_battle():
        """Clear existing battle state and start a completely new battle"""
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Clear existing battle state
        save_battle_state_to_db(user['_id'], None)
        
        # Start new battle using the existing start_battle function
        return start_battle()

    @app.route('/api/battle/end', methods=['POST'])
    def end_battle():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Get the reason for ending the battle
        data = request.json or {}
        reason = data.get('reason', 'unknown')
        winner = data.get('winner', 'enemy')
        
        # If the player ran from battle, treat it as a loss
        if reason == 'player_ran' or winner == 'enemy':
            # Get current battle state for statistics
            battle_state = get_battle_state_from_db(user['_id'])
            
            # Reset player to level 1 and generate new enemy team
            reset_level = reset_player_to_level_one(user['_id'])
            generate_new_enemy_team_for_level(user['_id'], reset_level)
            
            # Update MongoDB stats for loss
            profiles = get_player_profiles_collection()
            user_id = user['_id']
            get_or_create_player_profile(str(user_id))
            profiles.update_one({'_id': str(user_id)}, {'$inc': {'statistics.total_losses': 1}})
            
            # Update team and Pokemon usage if we have battle state
            if battle_state is not None:
                # Get the current team composition as a list of Pokémon IDs
                player_team = battle_state.get('player_team', [])
                team_comp = [poke.get('id') or poke.get('pokemon_id') for poke in player_team]
                team_key = json.dumps(team_comp)  # Use as a string key
                
                # Increment usage count for this composition
                profiles.update_one({'_id': str(user_id)}, {f'$inc': {f'team_usage.{team_key}': 1}}, upsert=True)
                
                # Pokémon usage
                for poke_id in team_comp:
                    if poke_id is not None:
                        profiles.update_one({'_id': str(user_id)}, {f'$inc': {f'pokemon_usage.{poke_id}': 1}}, upsert=True)
                
                # Update most used team and Pokémon
                updated_profile = profiles.find_one({'_id': str(user_id)})
                if updated_profile:
                    team_usage = updated_profile.get('team_usage', {})
                    pokemon_usage = updated_profile.get('pokemon_usage', {})
                else:
                    team_usage = {}
                    pokemon_usage = {}
                
                most_used_team_key = max(team_usage, key=lambda k: team_usage[k]) if team_usage else None
                most_used_team = json.loads(most_used_team_key) if most_used_team_key else []
                most_used_pokemon_id = max(pokemon_usage, key=lambda k: pokemon_usage[k]) if pokemon_usage else None
                
                # Always set statistics.most_used_team to the composition (list of IDs)
                profiles.update_one({'_id': str(user_id)}, {'$set': {'statistics.most_used_team': most_used_team, 'statistics.most_used_pokemon_id': int(most_used_pokemon_id) if most_used_pokemon_id else None}})
            
            # Clear battle state
            save_battle_state_to_db(user['_id'], None)
            
            # --- Save battle record for loss (end_battle) ---
            player_level = battle_state.get('player_level') if battle_state else None
            player_team = battle_state.get('player_team') if battle_state else []
            enemy_team = battle_state.get('enemy_team') if battle_state else []
            battle_log = list(battle_state.get('battle_log', [])) if battle_state else []
            save_battle_record(user['_id'], 'loss', player_team, enemy_team, battle_log, player_level)
            # --- end save battle record ---
            
            return jsonify({
                'success': True,
                'battle_ended': True,
                'winner': 'enemy',
                'reason': reason,
                'reset_level': reset_level,
                'message': f'You ran from battle and have been reset to level {reset_level}!'
            })
        
        # For other cases, just clear the battle state
        save_battle_state_to_db(user['_id'], None)
        return jsonify({'success': True})

    @app.route('/api/profile')
    def api_profile():
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401
        
        # Get player level info and profile
        level_info = get_player_level_info(user['_id'])
        profile = get_or_create_player_profile(str(user['_id']))
        
        # Convert _id to string for JSON serialization
        profile['_id'] = str(profile['_id'])
        profile['username'] = user['username']
        profile['level_info'] = level_info

        return jsonify({'success': True, 'profile': profile})

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

    @app.route('/api/pokemon/<int:pokemon_id>/moves-with-types')
    def get_pokemon_moves_with_types(pokemon_id):
        """Get the moves with their type information for a specific Pokémon"""
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                m.move_name,
                m.power,
                m.accuracy,
                m.category,
                t.type_name
            FROM PokemonHasMove phm
            JOIN Move m ON phm.move_id = m.move_id
            JOIN Type t ON m.type_id = t.type_id
            WHERE phm.pokemon_id = ?
            ORDER BY m.move_name
        """, (pokemon_id,))
        
        moves = [{
            'name': row['move_name'],
            'type': row['type_name'],
            'power': row['power'],
            'accuracy': row['accuracy'],
            'category': row['category']
        } for row in cur.fetchall()]
        
        conn.close()
        return jsonify({'moves': moves})

    @app.route('/api/move/<int:move_id>')
    def get_move_by_id(move_id):
        """Get move data by move ID"""
        from app.db import get_move_data
        
        move_data = get_move_data(move_id)
        if not move_data:
            return jsonify({'error': 'Move not found'}), 404
        
        return jsonify(move_data)

    @app.route('/api/type/<int:type_id>')
    def get_type_by_id(type_id):
        """Get type data by type ID"""
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT type_id, type_name FROM Type WHERE type_id = ?", (type_id,))
        row = cur.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Type not found'}), 404
        
        return jsonify({
            'type_id': row['type_id'],
            'type_name': row['type_name']
        })

    @app.route('/type_effectiveness')
    def type_effectiveness():
        return render_template('type_effectiveness.html')

    @app.route('/api/type_effectiveness/<type_name>')
    def get_type_effectiveness_data(type_name):
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Get the type ID for the given type name
            cur.execute("SELECT type_id FROM Type WHERE LOWER(type_name) = LOWER(?)", (type_name,))
            type_row = cur.fetchone()
            if not type_row:
                return jsonify({'error': f'Type "{type_name}" not found'}), 404
            
            attacking_type_id = type_row['type_id']
            
            # Get all effectiveness relationships for this type
            cur.execute("""
                SELECT t.type_name as defending_type, te.effectiveness
                FROM TypeEffectiveness te
                JOIN Type t ON t.type_id = te.defending_type_id
                WHERE te.attacking_type_id = ?
                ORDER BY t.type_name
            """, (attacking_type_id,))
            
            # Organize results by effectiveness
            effectiveness_data = {
                '2': [],    # Super effective
                '0.5': [],  # Not very effective
                '0': [],    # No effect
                '1': []     # Normal damage
            }
            
            for row in cur.fetchall():
                eff_key = str(row['effectiveness'])
                effectiveness_data[eff_key].append(row['defending_type'])
            
            conn.close()
            return jsonify(effectiveness_data)
            
        except Exception as e:
            print(f"Error getting type effectiveness data: {e}")
            return jsonify({'error': 'Failed to get type effectiveness data'}), 500

    
    @app.route('/api/user_stats')
    def user_stats():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        profiles = get_player_profiles_collection()
        profile = profiles.find_one({'_id': user['_id']})
        # --- NEW: Calculate from logs ---
        battle_logs = get_battle_logs_collection()
        win_count = battle_logs.count_documents({'user_id': str(user['_id']), 'result': 'win'})
        loss_count = battle_logs.count_documents({'user_id': str(user['_id']), 'result': 'loss'})
        # --- END NEW ---
        stats = profile.get('statistics', {}) if profile else {}
        raw_team = stats.get('most_used_team')
        if isinstance(raw_team, list):
            most_used_team = raw_team
        elif isinstance(raw_team, int):
            most_used_team = [raw_team]
        else:
            most_used_team = []
        most_used_pokemon = stats.get('most_used_pokemon_id', None)
        # Fetch Pokémon details for the team and the most used Pokémon
        team_details = []
        for poke in most_used_team:
            try:
                poke_id = int(poke)
                poke_obj = fetch_pokemon_by_id(poke_id)
                if poke_obj:
                    poke_obj['type1'] = poke_obj['type'][0] if poke_obj.get('type') and len(poke_obj['type']) > 0 else None
                    poke_obj['type2'] = poke_obj['type'][1] if poke_obj.get('type') and len(poke_obj['type']) > 1 else None
                    team_details.append(poke_obj)
            except (ValueError, TypeError):
                continue

        pokemon_details = None
        if most_used_pokemon:
            try:
                poke_id = int(most_used_pokemon)
                poke_obj = fetch_pokemon_by_id(poke_id)
                if poke_obj:
                    poke_obj['type1'] = poke_obj['type'][0] if poke_obj.get('type') and len(poke_obj['type']) > 0 else None
                    poke_obj['type2'] = poke_obj['type'][1] if poke_obj.get('type') and len(poke_obj['type']) > 1 else None
                    pokemon_details = poke_obj
            except (ValueError, TypeError):
                pokemon_details = None
        return jsonify({
            'total_wins': win_count,      # Use calculated value
            'total_losses': loss_count,   # Use calculated value
            'most_used_team': team_details,
            'most_used_pokemon': pokemon_details
        })

    @app.route('/api/enemy_team_type_summary')
    def api_enemy_team_type_summary():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        profile = get_or_create_player_profile(str(user['_id']))
        enemy_team = profile.get('current_enemy_team')
        if not enemy_team:
            current_level = profile.get('current_level', 1)
            enemy_team = generate_enemy_team_with_moves(current_level)
        from app.db import get_pokemon_full_data, get_type_effectiveness
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT type_id, type_name FROM Type")
        type_rows = cur.fetchall()
        type_id_to_name = {row['type_id']: row['type_name'] for row in type_rows}
        all_type_ids = list(type_id_to_name.keys())
        enemy_type_ids = []
        for poke in enemy_team:
            if poke:
                full = get_pokemon_full_data(poke.get('id') or poke.get('pokemon_id'))
                if full and 'types' in full:
                    enemy_type_ids.extend(full['types'])
        effectiveness_list = []
        for atk_id in all_type_ids:
            eff = 1.0
            for def_id in enemy_type_ids:
                eff *= get_type_effectiveness(atk_id, [def_id])
            effectiveness_list.append((type_id_to_name[atk_id], eff))
        # Ignore 0x (immunity) types
        weaknesses = sorted([t for t, e in effectiveness_list if e > 1.01 and e > 0.01], key=lambda t: t)
        resistances = sorted([t for t, e in effectiveness_list if e < 0.99 and e > 0.01], key=lambda t: t)
        return jsonify({
            'weaknesses': weaknesses,
            'resistances': resistances
        })

    @app.route('/battle-history')
    def battle_history_page():
        user_id = session.get('user_id')
        username = session.get('username')
        if not user_id or not username:
            return redirect(url_for('home'))
        return render_template('battle_history.html')
    
    @app.route('/api/battle/history')
    def battle_history():
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        battle_logs = get_battle_logs_collection()
        records = list(battle_logs.find({'user_id': str(user['_id'])}).sort('timestamp', -1))
        for rec in records:
            rec['_id'] = str(rec['_id'])
            if 'timestamp' in rec:
                rec['timestamp'] = rec['timestamp'].isoformat() + 'Z'
        return jsonify({'records': records})


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
        attack_stat = attacker.get('attack', attacker.get('atk', 50))  # Try 'attack' first, fallback to 'atk'
        defense_stat = defender.get('defense', defender.get('def', 50))  # Try 'defense' first, fallback to 'def'
        attack_name = 'Attack'
        defense_name = 'Defense'
    else:  # special
        attack_stat = attacker.get('sp_atk', 50)
        defense_stat = defender.get('sp_def', 50)
        attack_name = 'Special Attack'
        defense_name = 'Special Defense'
    
    # Check accuracy
    if move_accuracy > 0:
        if random.randint(1, 100) > move_accuracy:
            return 0, False, False, 1.0, f"Move missed (accuracy: {move_accuracy}%)"
    
    # Calculate type effectiveness
    effectiveness = get_type_effectiveness(move_type, defender['types'])
    
    # Check for STAB (Same Type Attack Bonus)
    stab = 1.5 if move_type in attacker['types'] else 1.0
    
    # Critical hit calculation (6.25% chance)
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

# New functions for the updated system
def get_or_generate_enemy_team(user_id):
    """Get current enemy team or generate a new one if needed."""
    profile = get_or_create_player_profile(str(user_id))
    current_enemy_team = profile.get('current_enemy_team')
    
    if not current_enemy_team:
        # Generate new enemy team
        current_level = profile.get('current_level', 1)
        enemy_team = generate_enemy_team_with_moves(current_level)
        
        # Save to profile
        update_player_profile(str(user_id), {'current_enemy_team': enemy_team})
        return enemy_team
    
    return current_enemy_team

def generate_new_enemy_team_for_level(user_id, level):
    """Generate and save a new enemy team for the specified level."""
    enemy_team = generate_enemy_team_with_moves(level)
    update_player_profile(str(user_id), {'current_enemy_team': enemy_team})
    return enemy_team

def save_battle_record(user_id, result, player_team, enemy_team, battle_log, level=None):
    battle_logs = get_battle_logs_collection()
    record = {
        'user_id': str(user_id),
        'timestamp': datetime.utcnow(),
        'result': result,
        'player_team': player_team,
        'enemy_team': enemy_team,
        'battle_log': battle_log,
    }
    if level is not None:
        record['level'] = level
    battle_logs.insert_one(record)


def get_enemy_team_config(player_level):
    """Get enemy team configuration based on player level"""
    # Team size increases at certain milestones, but cost budget always increases
    if player_level <= 10:
        pokemon_count = 3
    elif player_level <= 20:
        pokemon_count = 4
    elif player_level <= 30:
        pokemon_count = 5
    else:
        pokemon_count = 6
    cost_budget = 7 + player_level  # Start at 8, +1 per level
    return {'pokemon_count': pokemon_count, 'cost_budget': cost_budget}

def calculate_pokemon_stats(base_stats, level):
    # Generate random IVs for each stat
    ivs = {stat: random.randint(0, 31) for stat in base_stats}
    evs = {stat: 0 for stat in base_stats}  # You can expand this if you want EVs
    stats = {}
    # HP uses a different formula
    stats['hp'] = int(((2 * base_stats['hp'] + ivs['hp'] + (evs['hp'] // 4)) * level) / 100) + level + 10
    # Other stats
    for stat in ['atk', 'def', 'sp_atk', 'sp_def', 'speed']:
        stats[stat] = int(((2 * base_stats[stat] + ivs[stat] + (evs[stat] // 4)) * level) / 100) + 5
    return stats

def apply_traditional_stats(pokemon, level):
    # Map the field names from the database to the expected format
    base_stats = {
        'hp': pokemon.get('hp', 50),
        'atk': pokemon.get('attack', 50),  # Map 'attack' to 'atk'
        'def': pokemon.get('defense', 50),  # Map 'defense' to 'def'
        'sp_atk': pokemon.get('sp_atk', 50),
        'sp_def': pokemon.get('sp_def', 50),
        'speed': pokemon.get('speed', 50)
    }
    stats = calculate_pokemon_stats(base_stats, level)
    # Update the Pokémon object with the calculated stats using the original field names
    pokemon['hp'] = stats['hp']
    pokemon['attack'] = stats['atk']  # Keep original field name
    pokemon['defense'] = stats['def']  # Keep original field name
    pokemon['sp_atk'] = stats['sp_atk']
    pokemon['sp_def'] = stats['sp_def']
    pokemon['speed'] = stats['speed']
    return pokemon

def assign_random_moves(pokemon):
    """Assigns 4 random moves to a Pokémon."""
    # Get full Pokémon data including all available moves
    # Handle both 'id' and 'pokemon_id' fields
    pokemon_id = pokemon.get('id') or pokemon.get('pokemon_id')
    if not pokemon_id:
        print(f"DEBUG: No valid ID found for {pokemon.get('name', 'Unknown')}")
        pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
        return pokemon
        
    full_data = get_pokemon_full_data(pokemon_id)
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

def generate_enemy_team_with_moves(player_level):
    """Generate enemy team with pre-assigned moves based on player level"""
    from app.db import get_pokemon_full_data
    
    config = get_enemy_team_config(player_level)
    pokemon_count = config['pokemon_count']
    cost_budget = config['cost_budget']
    
    enemy_team = []
    enemy_pokemon_level = min(100, 50 + ((player_level - 1) // 2))
    
    # Get all Pokémon with their costs
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.pokemon_id, p.name, p.cost, p.hp, p.atk, p.def, p.sp_atk, p.sp_def, p.speed
        FROM Pokemon p 
        WHERE p.cost <= ? 
        ORDER BY RANDOM()
    """, (cost_budget,))
    
    available_pokemon = cur.fetchall()
    conn.close()
    
    if not available_pokemon:
        # Fallback to basic Pokémon if no suitable ones found
        fallback_ids = [25, 6, 9, 3, 12, 15]  # Pikachu, Charizard, Blastoise, Venusaur, Butterfree, Beedrill
        for i in range(min(pokemon_count, len(fallback_ids))):
            pokemon = fetch_pokemon_by_id(fallback_ids[i])
            if pokemon:
                pokemon['level'] = enemy_pokemon_level
                pokemon = apply_traditional_stats(pokemon, enemy_pokemon_level)
                enemy_team.append(pokemon)
    else:
        # Select Pokémon that fit within the budget
        selected_pokemon = []
        remaining_budget = cost_budget
        
        for pokemon_data in available_pokemon:
            if len(selected_pokemon) >= pokemon_count:
                break
                
            pokemon_id, name, cost, hp, atk, defense, sp_atk, sp_def, speed = pokemon_data
            
            # Check if we can afford this Pokémon
            if cost <= remaining_budget:
                pokemon = fetch_pokemon_by_id(pokemon_id)
                if pokemon:
                    pokemon['level'] = enemy_pokemon_level
                    pokemon = apply_traditional_stats(pokemon, enemy_pokemon_level)
                    selected_pokemon.append(pokemon)
                    remaining_budget -= cost
        
        enemy_team = selected_pokemon
    
    # Ensure we have the required number of Pokémon
    while len(enemy_team) < pokemon_count:
        # Add random Pokémon if we don't have enough
        random_pokemon = fetch_pokemon_by_id(random.randint(1, 1025))
        if random_pokemon and random_pokemon not in enemy_team:
            random_pokemon['level'] = enemy_pokemon_level
            random_pokemon = apply_traditional_stats(random_pokemon, enemy_pokemon_level)
            enemy_team.append(random_pokemon)
    
    # Pre-assign moves to each enemy Pokémon
    for i, pokemon in enumerate(enemy_team):
        if not pokemon:
            continue
            
        # Get full Pokémon data including all available moves
        pokemon_id = pokemon.get('id') or pokemon.get('pokemon_id')
        if not pokemon_id:
            pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
            continue
            
        full_data = get_pokemon_full_data(pokemon_id)
        if not full_data or not full_data['move_ids']:
            # Fallback to default moves if no moves available
            pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
            continue
        
        # Filter out invalid move IDs (those that don't exist in Move table)
        valid_moves = []
        for move_id in full_data['move_ids']:
            move_data = get_move_data(move_id)
            if move_data:
                valid_moves.append(move_id)
        
        if not valid_moves:
            # If no valid moves, use some basic moves
            pokemon['assigned_moves'] = [1, 2, 3, 4]  # Default move IDs
            continue
        
        # Randomly select 4 moves from available moves
        if len(valid_moves) <= 4:
            selected_moves = valid_moves
        else:
            selected_moves = random.sample(valid_moves, 4)
        
        pokemon['assigned_moves'] = selected_moves
        
        # Set up battle-ready stats
        pokemon['max_hp'] = pokemon['hp']
        pokemon['current_hp'] = pokemon['hp']
        pokemon['id'] = pokemon.get('id') or pokemon.get('pokemon_id')
        pokemon['pokemon_id'] = pokemon['id']
        pokemon['name'] = pokemon.get('name', 'Unknown')
        
        enemy_team[i] = pokemon
    
    return enemy_team

