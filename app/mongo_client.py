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

def get_battle_logs():
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
    profile = profiles.find_one({"_id": player_id})
    
    if not profile:
        # Create new profile with default values
        profile = {
            "_id": player_id,
            "current_level": 1,
            "max_level_reached": 1,
            "current_streak": 0,
            "best_streak": 0,
            "current_enemy_team": None,  # Will be generated when first accessed
            "statistics": {
                "total_wins": 0,
                "total_losses": 0,
                "most_used_team_id": None,
                "most_used_pokemon_id": None
            },
            "preferences": {
                "sound": True,
                "theme": "light"
            },
            "last_battle_id": None
        }
        profiles.insert_one(profile)
    
    return profile

def update_player_profile(player_id, updates):
    """Update player profile with new data."""
    profiles = get_player_profiles_collection()
    profiles.update_one({"_id": player_id}, {"$set": updates})

def get_player_level_info(player_id):
    """Get current level, max level, and streak information."""
    profile = get_or_create_player_profile(player_id)
    return {
        "current_level": profile.get("current_level", 1),
        "max_level_reached": profile.get("max_level_reached", 1),
        "current_streak": profile.get("current_streak", 0),
        "best_streak": profile.get("best_streak", 0)
    }

def increment_player_level(player_id):
    """Increment player level and update streaks."""
    profiles = get_player_profiles_collection()
    profile = profiles.find_one({"_id": player_id})
    
    if not profile:
        return 1
    
    current_level = profile.get("current_level", 1)
    max_level = profile.get("max_level_reached", 1)
    current_streak = profile.get("current_streak", 0)
    best_streak = profile.get("best_streak", 0)
    
    new_level = current_level + 1
    new_streak = current_streak + 1
    new_max_level = max(max_level, new_level)
    new_best_streak = max(best_streak, new_streak)
    
    profiles.update_one(
        {"_id": player_id},
        {
            "$set": {
                "current_level": new_level,
                "max_level_reached": new_max_level,
                "current_streak": new_streak,
                "best_streak": new_best_streak
            }
        }
    )
    
    return new_level

def reset_player_to_level_one(player_id):
    """Reset player to level 1 and update max level if needed."""
    profiles = get_player_profiles_collection()
    profile = profiles.find_one({"_id": player_id})
    
    if not profile:
        return 1
    
    current_level = profile.get("current_level", 1)
    max_level = profile.get("max_level_reached", 1)
    
    # Update max level if current level was higher
    new_max_level = max(max_level, current_level)
    
    profiles.update_one(
        {"_id": player_id},
        {
            "$set": {
                "current_level": 1,
                "max_level_reached": new_max_level,
                "current_streak": 0
            }
        }
    )
    
    return 1 