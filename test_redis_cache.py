#!/usr/bin/env python3
"""
Redis Cache Test Script for Pikapi
Tests cache functionality and measures performance improvements
"""

import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.cache import redis_cache, is_cache_available
from app.db import fetch_pokemon, fetch_pokemon_by_id, get_pokemon_full_data, get_move_data, get_type_effectiveness
from app.db_cached import (
    fetch_pokemon as cached_fetch_pokemon,
    fetch_pokemon_by_id as cached_fetch_pokemon_by_id,
    get_pokemon_full_data as cached_get_pokemon_full_data,
    get_move_data as cached_get_move_data,
    get_type_effectiveness as cached_get_type_effectiveness,
    warm_pokemon_cache,
    clear_pokemon_cache
)

def test_cache_connection():
    print("🔍 Testing Redis connection...")
    if is_cache_available():
        print("✅ Redis connection successful")
        stats = redis_cache.get_stats()
        print(f"   Memory used: {stats.get('used_memory', 'N/A')}")
        print(f"   Connected clients: {stats.get('connected_clients', 0)}")
        return True
    else:
        print("❌ Redis connection failed")
        print("   Please ensure Redis server is running")
        return False

def measure_performance(func, func_name, *args, **kwargs):
    start_time = time.time()
    result = func(*args, **kwargs)
    end_time = time.time()
    execution_time = (end_time - start_time) * 1000
    return result, execution_time

def test_pokemon_list_performance():
    print("\n📊 Testing Pokemon list performance...")
    print("   Testing without cache...")
    result1, time1 = measure_performance(fetch_pokemon, "fetch_pokemon")
    print(f"   Time: {time1:.2f}ms")
    print("   Testing with cache (first call)...")
    result2, time2 = measure_performance(cached_fetch_pokemon, "cached_fetch_pokemon")
    print(f"   Time: {time2:.2f}ms")
    print("   Testing with cache (second call)...")
    result3, time3 = measure_performance(cached_fetch_pokemon, "cached_fetch_pokemon")
    print(f"   Time: {time3:.2f}ms")
    if time1 > 0:
        improvement1 = ((time1 - time2) / time1) * 100
        improvement2 = ((time1 - time3) / time1) * 100
        print(f"   First call improvement: {improvement1:.1f}%")
        print(f"   Second call improvement: {improvement2:.1f}%")
    return len(result1) if result1 else 0

def test_individual_pokemon_performance():
    print("\n🎯 Testing individual Pokemon lookup performance...")
    pokemon_ids = [1, 25, 150, 151]
    total_time_without_cache = 0
    total_time_with_cache = 0
    for pokemon_id in pokemon_ids:
        print(f"   Testing Pokemon ID {pokemon_id}...")
        result1, time1 = measure_performance(fetch_pokemon_by_id, "fetch_pokemon_by_id", pokemon_id)
        total_time_without_cache += time1
        result2, time2 = measure_performance(cached_fetch_pokemon_by_id, "cached_fetch_pokemon_by_id", pokemon_id)
        total_time_with_cache += time2
        print(f"     Without cache: {time1:.2f}ms")
        print(f"     With cache: {time2:.2f}ms")
    avg_time_without = total_time_without_cache / len(pokemon_ids)
    avg_time_with = total_time_with_cache / len(pokemon_ids)
    if avg_time_without > 0:
        improvement = ((avg_time_without - avg_time_with) / avg_time_without) * 100
        print(f"   Average improvement: {improvement:.1f}%")
    return len(pokemon_ids)

def test_battle_data_performance():
    print("\n⚔️ Testing battle data performance...")
    print("   Testing Pokemon full data...")
    result1, time1 = measure_performance(get_pokemon_full_data, "get_pokemon_full_data", 25)
    result2, time2 = measure_performance(cached_get_pokemon_full_data, "cached_get_pokemon_full_data", 25)
    print(f"     Without cache: {time1:.2f}ms")
    print(f"     With cache: {time2:.2f}ms")
    print("   Testing move data...")
    result3, time3 = measure_performance(get_move_data, "get_move_data", 1)
    result4, time4 = measure_performance(cached_get_move_data, "cached_get_move_data", 1)
    print(f"     Without cache: {time3:.2f}ms")
    print(f"     With cache: {time4:.2f}ms")
    print("   Testing type effectiveness...")
    result5, time5 = measure_performance(get_type_effectiveness, "get_type_effectiveness", 1, [2, 3])
    result6, time6 = measure_performance(cached_get_type_effectiveness, "cached_get_type_effectiveness", 1, [2, 3])
    print(f"     Without cache: {time5:.2f}ms")
    print(f"     With cache: {time6:.2f}ms")
    return True

def test_cache_warming():
    print("\n🔥 Testing cache warming...")
    start_time = time.time()
    success = warm_pokemon_cache()
    end_time = time.time()
    if success:
        print(f"✅ Cache warming completed in {(end_time - start_time):.2f} seconds")
        print("   Testing performance after warming...")
        result, time_taken = measure_performance(cached_fetch_pokemon, "cached_fetch_pokemon")
        print(f"   Pokemon list query: {time_taken:.2f}ms")
        return True
    else:
        print("❌ Cache warming failed")
        return False

def test_cache_management():
    print("\n🛠️ Testing cache management...")
    print("   Testing cache clearing...")
    clear_pokemon_cache()
    print("   ✅ Pokemon cache cleared")
    stats = redis_cache.get_stats()
    print(f"   Cache stats: {stats}")
    return True

def test_filtered_queries():
    print("\n🔍 Testing filtered queries...")
    filters = {
        'search': 'pikachu',
        'cost': 3,
        'types': 'electric'
    }
    result1, time1 = measure_performance(fetch_pokemon, "fetch_pokemon", filters)
    print(f"   Without cache: {time1:.2f}ms")
    result2, time2 = measure_performance(cached_fetch_pokemon, "cached_fetch_pokemon", filters)
    print(f"   With cache: {time2:.2f}ms")
    if time1 > 0:
        improvement = ((time1 - time2) / time1) * 100
        print(f"   Improvement: {improvement:.1f}%")
    return len(result1) if result1 else 0

def main():
    print("🚀 Redis Cache Test Suite for Pikapi")
    print("=" * 50)
    if not test_cache_connection():
        print("\n❌ Cannot proceed without Redis connection")
        print("Please start Redis server and try again")
        return
    test_pokemon_list_performance()
    test_individual_pokemon_performance()
    test_battle_data_performance()
    test_filtered_queries()
    test_cache_warming()
    test_cache_management()
    print("\n" + "=" * 50)
    print("✅ Redis cache test suite completed!")
    print("\n📈 Expected Performance Improvements:")
    print("   • Pokemon list queries: 80-90% faster")
    print("   • Individual Pokemon lookups: 85-90% faster")
    print("   • Battle calculations: 75-80% faster")
    print("   • Team data queries: 80-90% faster")
    print("\n🔧 Cache Dashboard available at: http://localhost:5000/cache")

if __name__ == "__main__":
    main() 