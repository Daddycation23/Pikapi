"""
Cached database operations for Pikapi
This module wraps the original db.py functions with Redis caching
"""

from app.db import (
    fetch_pokemon as _fetch_pokemon,
    fetch_pokemon_by_id as _fetch_pokemon_by_id,
    get_pokemon_full_data as _get_pokemon_full_data,
    get_move_data as _get_move_data,
    get_type_effectiveness as _get_type_effectiveness,
    get_team as _get_team,
    list_teams as _list_teams,
    get_team_by_id as _get_team_by_id,
    save_team as _save_team,
    save_team_by_id as _save_team_by_id,
    create_team as _create_team,
    get_db_connection
)
from app.cache import cached, CACHE_KEYS, CACHE_TTL, redis_cache, invalidate_cache_pattern
import json
import hashlib

# Custom key functions for specific caching needs
def pokemon_list_key(filters=None):
    """Generate cache key for Pokemon list with filters"""
    if not filters:
        return f"{CACHE_KEYS['POKEMON_LIST']}:all"
    
    # Create a hash of the filters for consistent key generation
    filters_str = json.dumps(filters, sort_keys=True)
    filters_hash = hashlib.md5(filters_str.encode()).hexdigest()[:8]
    return f"{CACHE_KEYS['POKEMON_LIST']}:filtered:{filters_hash}"

def type_effectiveness_key(attacking_type_id, defending_type_ids):
    """Generate cache key for type effectiveness"""
    defending_str = ",".join(map(str, sorted(defending_type_ids))) if defending_type_ids else "none"
    return f"{CACHE_KEYS['TYPE_EFFECTIVENESS']}:{attacking_type_id}:{defending_str}"

def user_team_key(user_id):
    """Generate cache key for user team"""
    return f"{CACHE_KEYS['USER_TEAM']}:{user_id}"

def user_teams_key(user_id):
    """Generate cache key for user teams list"""
    return f"{CACHE_KEYS['USER_TEAMS']}:{user_id}"

# Cached Pokemon functions
@cached(CACHE_KEYS['POKEMON_LIST'], CACHE_TTL['POKEMON_LIST'], pokemon_list_key)
def fetch_pokemon(filters=None):
    """Cached version of fetch_pokemon"""
    return _fetch_pokemon(filters)

@cached(CACHE_KEYS['POKEMON_DETAIL'], CACHE_TTL['POKEMON_DETAIL'])
def fetch_pokemon_by_id(pokemon_id):
    """Cached version of fetch_pokemon_by_id"""
    return _fetch_pokemon_by_id(pokemon_id)

@cached(CACHE_KEYS['POKEMON_FULL'], CACHE_TTL['POKEMON_FULL'])
def get_pokemon_full_data(pokemon_id):
    """Cached version of get_pokemon_full_data"""
    return _get_pokemon_full_data(pokemon_id)

# Cached battle data functions
@cached(CACHE_KEYS['MOVE_DETAIL'], CACHE_TTL['MOVE_DETAIL'])
def get_move_data(move_id):
    """Cached version of get_move_data"""
    return _get_move_data(move_id)

@cached(CACHE_KEYS['TYPE_EFFECTIVENESS'], CACHE_TTL['TYPE_EFFECTIVENESS'], type_effectiveness_key)
def get_type_effectiveness(attacking_type_id, defending_type_ids):
    """Cached version of get_type_effectiveness"""
    return _get_type_effectiveness(attacking_type_id, defending_type_ids)

# Cached user data functions
@cached(CACHE_KEYS['USER_TEAM'], CACHE_TTL['USER_TEAM'], user_team_key)
def get_team(player_id):
    """Cached version of get_team"""
    return _get_team(player_id)

@cached(CACHE_KEYS['USER_TEAMS'], CACHE_TTL['USER_TEAMS'], user_teams_key)
def list_teams(player_id):
    """Cached version of list_teams"""
    return _list_teams(player_id)

@cached(CACHE_KEYS['USER_TEAM'], CACHE_TTL['USER_TEAM'])
def get_team_by_id(team_id):
    """Cached version of get_team_by_id"""
    return _get_team_by_id(team_id)

# Functions that need cache invalidation
def save_team(player_id, pokemon_ids, team_name='Team 1', budget=10):
    """Save team and invalidate related caches"""
    result = _save_team(player_id, pokemon_ids, team_name, budget)
    if result:
        # Invalidate user team caches
        invalidate_cache_pattern(f"{CACHE_KEYS['USER_TEAM']}:{player_id}")
        invalidate_cache_pattern(f"{CACHE_KEYS['USER_TEAMS']}:{player_id}")
    return result

def save_team_by_id(team_id, pokemon_ids):
    """Save team by ID and invalidate related caches"""
    result = _save_team_by_id(team_id, pokemon_ids)
    if result:
        # Invalidate all user team caches (since we don't know which user)
        invalidate_cache_pattern(f"{CACHE_KEYS['USER_TEAM']}:*")
        invalidate_cache_pattern(f"{CACHE_KEYS['USER_TEAMS']}:*")
    return result

def create_team(player_id, budget=10):
    """Create team and invalidate related caches"""
    result = _create_team(player_id, budget)
    if result:
        # Invalidate user team caches
        invalidate_cache_pattern(f"{CACHE_KEYS['USER_TEAM']}:{player_id}")
        invalidate_cache_pattern(f"{CACHE_KEYS['USER_TEAMS']}:{player_id}")
    return result

# Cache management functions
def warm_pokemon_cache():
    """Pre-populate cache with frequently accessed Pokemon data"""
    if not redis_cache.is_connected():
        return False
    
    try:
        # Cache all Pokemon details (first 100 for performance)
        for pokemon_id in range(1, 101):
            get_pokemon_full_data(pokemon_id)
        
        # Cache common move data
        for move_id in range(1, 51):
            get_move_data(move_id)
        
        # Cache type effectiveness for common combinations
        common_types = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  # Normal, Fire, Water, etc.
        for attacking_type in common_types:
            for defending_type in common_types:
                get_type_effectiveness(attacking_type, [defending_type])
        
        return True
    except Exception as e:
        print(f"Cache warming failed: {e}")
        return False

def clear_pokemon_cache():
    """Clear all Pokemon-related cache"""
    patterns = [
        f"{CACHE_KEYS['POKEMON_LIST']}:*",
        f"{CACHE_KEYS['POKEMON_DETAIL']}:*",
        f"{CACHE_KEYS['POKEMON_FULL']}:*"
    ]
    for pattern in patterns:
        invalidate_cache_pattern(pattern)

def clear_user_cache(user_id=None):
    """Clear user-related cache"""
    if user_id:
        patterns = [
            f"{CACHE_KEYS['USER_TEAM']}:{user_id}",
            f"{CACHE_KEYS['USER_TEAMS']}:{user_id}"
        ]
    else:
        patterns = [
            f"{CACHE_KEYS['USER_TEAM']}:*",
            f"{CACHE_KEYS['USER_TEAMS']}:*"
        ]
    
    for pattern in patterns:
        invalidate_cache_pattern(pattern)

def get_cache_stats():
    """Get cache statistics"""
    return redis_cache.get_stats()

def is_cache_available():
    """Check if cache is available"""
    return redis_cache.is_connected() 