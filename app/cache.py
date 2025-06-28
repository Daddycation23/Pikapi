import redis
import json
import hashlib
import pickle
from functools import wraps
from typing import Any, Optional, Dict, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RedisCache:
    """Redis caching wrapper for Pikapi application"""
    
    def __init__(self, host='localhost', port=6379, db=0, password=None, decode_responses=False):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.Redis(
                host=host,
                port=port,
                db=db,
                password=password,
                decode_responses=decode_responses,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established successfully")
            self.connected = True
        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed: {e}")
            self.connected = False
        except Exception as e:
            logger.error(f"Redis initialization error: {e}")
            self.connected = False
    
    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if not self.connected:
            return False
        try:
            self.redis_client.ping()
            return True
        except:
            self.connected = False
            return False
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.is_connected():
            return None
        try:
            value = self.redis_client.get(key)
            if value:
                return pickle.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache with TTL"""
        if not self.is_connected():
            return False
        try:
            serialized_value = pickle.dumps(value)
            return self.redis_client.setex(key, ttl, serialized_value)
        except Exception as e:
            logger.error(f"Redis set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.is_connected():
            return False
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Redis delete error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.is_connected():
            return False
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            logger.error(f"Redis exists error for key {key}: {e}")
            return False
    
    def flush_db(self) -> bool:
        """Clear all keys in current database"""
        if not self.is_connected():
            return False
        try:
            self.redis_client.flushdb()
            logger.info("Redis database flushed")
            return True
        except Exception as e:
            logger.error(f"Redis flush error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Redis statistics"""
        if not self.is_connected():
            return {"connected": False}
        try:
            info = self.redis_client.info()
            return {
                "connected": True,
                "used_memory": info.get('used_memory_human', 'N/A'),
                "connected_clients": info.get('connected_clients', 0),
                "total_commands_processed": info.get('total_commands_processed', 0),
                "keyspace_hits": info.get('keyspace_hits', 0),
                "keyspace_misses": info.get('keyspace_misses', 0)
            }
        except Exception as e:
            logger.error(f"Redis stats error: {e}")
            return {"connected": False, "error": str(e)}

# Global Redis instance
redis_cache = RedisCache()

def cache_key_generator(prefix: str, *args, **kwargs) -> str:
    """Generate cache key from prefix and arguments"""
    # Create a hash of the arguments for consistent key generation
    key_parts = [prefix]
    
    # Add positional arguments
    for arg in args:
        if isinstance(arg, (dict, list)):
            key_parts.append(hashlib.md5(json.dumps(arg, sort_keys=True).encode()).hexdigest()[:8])
        else:
            key_parts.append(str(arg))
    
    # Add keyword arguments
    if kwargs:
        sorted_kwargs = sorted(kwargs.items())
        kwargs_str = json.dumps(sorted_kwargs, sort_keys=True)
        key_parts.append(hashlib.md5(kwargs_str.encode()).hexdigest()[:8])
    
    return ":".join(key_parts)

def cached(prefix: str, ttl: int = 3600, key_func=None):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Skip caching if Redis is not connected
            if not redis_cache.is_connected():
                return func(*args, **kwargs)
            
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = cache_key_generator(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_result = redis_cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for key: {cache_key}")
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            if result is not None:
                redis_cache.set(cache_key, result, ttl)
                logger.debug(f"Cached result for key: {cache_key}")
            
            return result
        return wrapper
    return decorator

def invalidate_cache_pattern(pattern: str) -> bool:
    """Invalidate all cache keys matching a pattern"""
    if not redis_cache.is_connected():
        return False
    try:
        keys = redis_cache.redis_client.keys(pattern)
        if keys:
            redis_cache.redis_client.delete(*keys)
            logger.info(f"Invalidated {len(keys)} cache keys matching pattern: {pattern}")
        return True
    except Exception as e:
        logger.error(f"Cache invalidation error: {e}")
        return False

# Cache key constants
CACHE_KEYS = {
    'POKEMON_LIST': 'pokemon:list',
    'POKEMON_DETAIL': 'pokemon:detail',
    'POKEMON_FULL': 'pokemon:full',
    'MOVE_DETAIL': 'move:detail',
    'TYPE_EFFECTIVENESS': 'type:effectiveness',
    'USER_TEAM': 'user:team',
    'USER_TEAMS': 'user:teams',
}

# Cache TTL constants (in seconds)
CACHE_TTL = {
    'POKEMON_LIST': 3600,      # 1 hour
    'POKEMON_DETAIL': 7200,    # 2 hours
    'POKEMON_FULL': 7200,      # 2 hours
    'MOVE_DETAIL': 86400,      # 24 hours
    'TYPE_EFFECTIVENESS': 86400, # 24 hours
    'USER_TEAM': 1800,         # 30 minutes
    'USER_TEAMS': 1800,        # 30 minutes
}

def is_cache_available():
    """Check if cache is available and working"""
    return redis_cache.is_connected() 