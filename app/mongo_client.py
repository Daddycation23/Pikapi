from pymongo import MongoClient
import sys

DB_NAME = 'pokemon_app'
MONGO_URI = 'mongodb://localhost:27017'

_client = None
_db = None

try:
    _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    # Force connection on a request as the connect=True parameter of MongoClient seems
    # to be useless here
    _client.server_info()
    _db = _client[DB_NAME]
except Exception as e:
    print(f"[MongoDB] Connection failed: {e}", file=sys.stderr)
    _db = None

def get_db():
    """
    Returns the MongoDB database object for the app.
    Raises RuntimeError if the connection failed.
    """
    if _db is None:
        raise RuntimeError("MongoDB connection not established. Is the server running on localhost:27017?")
    return _db

# Example collection accessors

def get_player_profiles_collection():
    """Returns the player_profiles collection."""
    return get_db()['player_profiles']

def get_battle_logs_collection():
    """Returns the battle_logs collection."""
    return get_db()['battle_logs']

def get_teams_collection():
    """Returns the teams collection."""
    return get_db()['teams']

def get_battles_collection():
    """Returns the battles collection for storing battle state."""
    return get_db()['battles']

# New functions for the updated player profile system
def get_or_create_player_profile(player_id):
    """Get existing player profile or create a new one with default values."""
    profiles = get_player_profiles_collection()
    player_id = str(player_id)
    profile = profiles.find_one({"_id": player_id})
    
    if not profile:
        # Create new profile with default values
        profile = {
            "_id": player_id,
            "current_level": 1,
            "max_level_reached": 1,
            "current_enemy_team": None,  # Will be generated when first accessed
            "statistics": {
                "total_wins": 0,
                "total_losses": 0,
                "most_used_team": None,
                "most_used_pokemon_id": None
            },
        }
        profiles.insert_one(profile)
    
    return profile

def update_player_profile(player_id, updates):
    """Update player profile with new data."""
    profiles = get_player_profiles_collection()
    player_id = str(player_id)
    profiles.update_one({"_id": player_id}, {"$set": updates})

def get_player_level_info(player_id):
    """Get current level and best stage level (highest reached in battle history or current)."""
    profile = get_or_create_player_profile(str(player_id))
    current_level = profile.get("current_level", 1)
    # Find highest level in battle_logs
    battle_logs = get_battle_logs_collection()
    max_level_battle = battle_logs.find_one({'user_id': str(player_id), 'level': {'$exists': True}}, sort=[('level', -1)])
    highest_battle_level = max_level_battle["level"] if max_level_battle and "level" in max_level_battle else 1
    best_level = max(current_level, highest_battle_level)
    return {
        "current_level": current_level,
        "max_level_reached": best_level
    }

def increment_player_level(player_id):
    """Increment player level."""
    profiles = get_player_profiles_collection()
    player_id = str(player_id)
    profile = profiles.find_one({"_id": player_id})
    if not profile:
        return 1
    current_level = profile.get("current_level", 1)
    new_level = current_level + 1
    profiles.update_one(
        {"_id": player_id},
        {"$set": {
            "current_level": new_level,
        }}
    )
    return new_level

def reset_player_to_level_one(player_id):
    """Reset player to level 1 and update max level if needed."""
    profiles = get_player_profiles_collection()
    player_id = str(player_id)
    profile = profiles.find_one({"_id": player_id})
    if not profile:
        return 1
    current_level = profile.get("current_level", 1)
    max_level = profile.get("max_level_reached", 1)
    new_max_level = max(max_level, current_level)
    profiles.update_one(
        {"_id": player_id},
        {"$set": {
            "current_level": 1,
            "max_level_reached": new_max_level
        }}
    )
    return 1 