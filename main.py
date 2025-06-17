from flask import Flask, render_template, request, jsonify
import pandas as pd
import json

app = Flask(__name__)

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

def load_pokemon_data():
    try:
        # Try reading with utf-8-sig and tab separator to handle BOM and TSV format
        df = pd.read_csv('data.csv', encoding='utf-8-sig', sep='\t')
    except UnicodeDecodeError:
        try:
            # Fallback to latin-1 encoding with tab separator
            df = pd.read_csv('data.csv', encoding='latin-1', sep='\t')
        except UnicodeDecodeError:
            try:
                # Final fallback to cp1252 with tab separator
                df = pd.read_csv('data.csv', encoding='cp1252', sep='\t')
            except:
                # Last resort - try to skip bad lines
                df = pd.read_csv('data.csv', encoding='latin-1', sep='\t', on_bad_lines='skip')
    except Exception as e:
        print(f"Error reading CSV: {e}")
        # Try with error handling for malformed lines
        df = pd.read_csv('data.csv', encoding='latin-1', sep='\t', on_bad_lines='skip')
            
    pokemon_list = []
    for _, row in df.iterrows():
        if row['gen'] == 'I' or row['gen'] == 'II' or row['gen'] == 'III':
        # Assign cost based on total base stats (for demo purposes)
            total_stats = row['hp'] + row['attack'] + row['defense'] + row['sp_attack'] + row['sp_defense'] + row['speed']
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
                
            pokemon = {
                'id': int(row['national_number']),
                'name': row['english_name'],
                'img': f"/static/images/{pokemon_name_to_filename(row['english_name'])}.png",
                'cost': cost,
                'type': [row['primary_type']] + ([row['secondary_type']] if pd.notna(row['secondary_type']) else []),
                'hp': int(row['hp']),
                'attack': int(row['attack']),
                'defense': int(row['defense']),
                'sp_atk': int(row['sp_attack']),
                'sp_def': int(row['sp_defense']),
                'speed': int(row['speed']),
                'desc': row['description'] if pd.notna(row['description']) else "No description available."
            }
            pokemon_list.append(pokemon)
    return pokemon_list

# Load data once at startup
POKEMON_DATA = load_pokemon_data()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/edit_team')
def edit_team():
    # Placeholder team data - in real app, fetch from user's saved teams
    team = [
        POKEMON_DATA[24],  # Pikachu
        POKEMON_DATA[9],   # Caterpie
        POKEMON_DATA[132]  # Eevee
    ]
    return render_template('edit_team.html', team=team)

@app.route('/api/pokemon')
def get_pokemon():
    # Get filter parameters
    search = request.args.get('search', '').lower()
    type_filter = request.args.get('type', '')
    cost_filter = request.args.get('cost', '')
    
    filtered_pokemon = POKEMON_DATA
    
    # Apply search filter
    if search:
        filtered_pokemon = [p for p in filtered_pokemon if search in p['name'].lower()]
    
    # Apply type filter
    if type_filter:
        filtered_pokemon = [p for p in filtered_pokemon if type_filter in [t.lower() for t in p['type']]]
    
    # Apply cost filter
    if cost_filter:
        filtered_pokemon = [p for p in filtered_pokemon if p['cost'] == int(cost_filter)]
    
    return jsonify(filtered_pokemon)

@app.route('/api/pokemon/<int:pokemon_id>')
def get_pokemon_detail(pokemon_id):
    pokemon = next((p for p in POKEMON_DATA if p['id'] == pokemon_id), None)
    if pokemon:
        return jsonify(pokemon)
    return jsonify({'error': 'Pokemon not found'}), 404

@app.route('/api/team/validate', methods=['POST'])
def validate_team():
    team_data = request.json.get('team', [])
    total_cost = sum(p.get('cost', 0) for p in team_data)
    max_cost = 10
    
    return jsonify({
        'valid': total_cost <= max_cost,
        'total_cost': total_cost,
        'max_cost': max_cost,
        'remaining_cost': max_cost - total_cost
    })

if __name__ == '__main__':
    app.run(debug=True)