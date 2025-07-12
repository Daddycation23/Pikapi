from pymongo import MongoClient

# --- CONFIGURE THESE ---
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "pokemon_app"  # <-- CHANGE THIS
COLLECTION = "player_profiles"

# --- Import your team lookup function ---
import sys
sys.path.append("app")  # or wherever your app code is
from app.db import get_team_by_id  # adjust import if needed

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
profiles = db[COLLECTION]

# Find all profiles where most_used_team is an int (team_id)
for profile in profiles.find({"statistics.most_used_team": {"$type": "int"}}):
    team_id = profile["statistics"]["most_used_team"]
    # Get the Pokémon composition for this team_id
    try:
        pokemon_ids = get_team_by_id(team_id)
        if pokemon_ids and isinstance(pokemon_ids, list):
            # Update the profile to use the composition
            profiles.update_one(
                {"_id": profile["_id"]},
                {"$set": {"statistics.most_used_team": pokemon_ids}}
            )
            print(f"Updated user {profile['_id']} most_used_team to {pokemon_ids}")
        else:
            print(f"Could not find team for team_id {team_id} (user {profile['_id']})")
    except Exception as e:
        print(f"Error for user {profile['_id']}: {e}")

print("Done.")