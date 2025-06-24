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

def get_player_profiles():
    """Returns the player_profiles collection."""
    return get_db()['player_profiles']

def get_battle_logs():
    """Returns the battle_logs collection."""
    return get_db()['battle_logs'] 