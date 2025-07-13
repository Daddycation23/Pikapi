#!/usr/bin/env python3

import time
import sys
import os
import random
import gc

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

def bulk_performance_test(func, func_name, iterations, *args, **kwargs):
    """Test function performance over multiple iterations"""
    start_time = time.time()
    results = []
    for _ in range(iterations):
        result = func(*args, **kwargs)
        results.append(result)
    end_time = time.time()
    total_time = (end_time - start_time) * 1000
    avg_time = total_time / iterations
    return results, total_time, avg_time

def bulk_performance_test_memory_optimized(func, func_name, iterations, *args, **kwargs):
    """Test function performance without storing all results in memory"""
    start_time = time.time()
    for _ in range(iterations):
        result = func(*args, **kwargs)  # Just call, don't store
    end_time = time.time()
    total_time = (end_time - start_time) * 1000
    avg_time = total_time / iterations
    return total_time, avg_time

def test_pokemon_list_performance():
    print("\n📊 Testing Pokemon list performance...")
    print("   Testing without cache (10,000 iterations)...")
    total_time1, avg_time1 = bulk_performance_test_memory_optimized(fetch_pokemon, "fetch_pokemon", 10000)
    print(f"   Total time: {total_time1:.2f}ms, Avg: {avg_time1:.2f}ms")
    
    print("   Testing with cache (10,000 iterations)...")
    total_time2, avg_time2 = bulk_performance_test_memory_optimized(cached_fetch_pokemon, "cached_fetch_pokemon", 10000)
    print(f"   Total time: {total_time2:.2f}ms, Avg: {avg_time2:.2f}ms")
    
    if total_time1 > 0:
        improvement = ((total_time1 - total_time2) / total_time1) * 100
        print(f"   Performance improvement: {improvement:.1f}%")
    return 10000  # Return iteration count instead of result length

def test_individual_pokemon_performance():
    print("\n🎯 Testing individual Pokemon lookup performance...")
    # Test with a reasonable number of Pokemon IDs to avoid memory issues
    pokemon_ids = list(range(1, 1000))  # First 1000 Pokemon (reduced from 1000)
    print(f"   Testing {len(pokemon_ids)} Pokemon lookups...")
    
    print("   Testing without cache...")
    total_time_without_cache = 0
    for pokemon_id in pokemon_ids:
        result1, time1 = measure_performance(fetch_pokemon_by_id, "fetch_pokemon_by_id", pokemon_id)
        total_time_without_cache += time1
    
    print("   Testing with cache...")
    total_time_with_cache = 0
    for pokemon_id in pokemon_ids:
        result2, time2 = measure_performance(cached_fetch_pokemon_by_id, "cached_fetch_pokemon_by_id", pokemon_id)
        total_time_with_cache += time2
    
    avg_time_without = total_time_without_cache / len(pokemon_ids)
    avg_time_with = total_time_with_cache / len(pokemon_ids)
    
    print(f"   Total time without cache: {total_time_without_cache:.2f}ms")
    print(f"   Total time with cache: {total_time_with_cache:.2f}ms")
    print(f"   Average time without cache: {avg_time_without:.2f}ms")
    print(f"   Average time with cache: {avg_time_with:.2f}ms")
    
    if total_time_without_cache > 0:
        improvement = ((total_time_without_cache - total_time_with_cache) / total_time_without_cache) * 100
        print(f"   Performance improvement: {improvement:.1f}%")
    return len(pokemon_ids)

def test_battle_data_performance():
    print("\n⚔️ Testing battle data performance...")
    
    # Test Pokemon full data with multiple Pokemon
    print("   Testing Pokemon full data (1000 Pokemon)...")
    pokemon_ids = list(range(1, 1000))
    
    total_time_without_cache = 0
    total_time_with_cache = 0
    
    for pokemon_id in pokemon_ids:
        result1, time1 = measure_performance(get_pokemon_full_data, "get_pokemon_full_data", pokemon_id)
        total_time_without_cache += time1
        result2, time2 = measure_performance(cached_get_pokemon_full_data, "cached_get_pokemon_full_data", pokemon_id)
        total_time_with_cache += time2
    
    print(f"     Total time without cache: {total_time_without_cache:.2f}ms")
    print(f"     Total time with cache: {total_time_with_cache:.2f}ms")
    
    # Test move data with multiple moves
    print("   Testing move data (1000 moves)...")
    move_ids = list(range(1, 1000))
    
    total_move_time_without = 0
    total_move_time_with = 0
    
    for move_id in move_ids:
        result3, time3 = measure_performance(get_move_data, "get_move_data", move_id)
        total_move_time_without += time3
        result4, time4 = measure_performance(cached_get_move_data, "cached_get_move_data", move_id)
        total_move_time_with += time4
    
    print(f"     Total move time without cache: {total_move_time_without:.2f}ms")
    print(f"     Total move time with cache: {total_move_time_with:.2f}ms")
    
    # Test type effectiveness with multiple combinations
    print("   Testing type effectiveness ( combinations)...")
    type_combinations = [
        (1, [2, 3]), (2, [1, 4]), (3, [1, 2]), (4, [2, 3]), (5, [1, 4]),
        (6, [2, 5]), (7, [1, 6]), (8, [2, 7]), (9, [1, 8]), (10, [2, 9]),
        (1, [5, 6]), (2, [6, 7]), (3, [7, 8]), (4, [8, 9]), (5, [9, 10]),
        (6, [1, 10]), (7, [2, 1]), (8, [3, 2]), (9, [4, 3]), (10, [5, 4]),
        (1, [7, 8]), (2, [8, 9]), (3, [9, 10]), (4, [10, 1]), (5, [1, 2]),
        (6, [2, 3]), (7, [3, 4]), (8, [4, 5]), (9, [5, 6]), (10, [6, 7]),
        (1, [9, 10]), (2, [10, 1]), (3, [1, 2]), (4, [2, 3]), (5, [3, 4]),
        (6, [4, 5]), (7, [5, 6]), (8, [6, 7]), (9, [7, 8]), (10, [8, 9]),
        (1, [1, 2]), (2, [2, 3]), (3, [3, 4]), (4, [4, 5]), (5, [5, 6]),
        (6, [6, 7]), (7, [7, 8]), (8, [8, 9]), (9, [9, 10]), (10, [10, 1]), (11, [1, 2]), (12, [2, 3]), (13, [3, 4]), (14, [4, 5]), (15, [5, 6]),
        (16, [6, 7]), (17, [7, 8]), (18, [8, 9]), (19, [9, 10]), (20, [10, 1]), (21, [1, 2]), (22, [2, 3]), (23, [3, 4]), (24, [4, 5]), (25, [5, 6]),
        (26, [6, 7]), (27, [7, 8]), (28, [8, 9]), (29, [9, 10]), (30, [10, 1]), (31, [1, 2]), (32, [2, 3]), (33, [3, 4]), (34, [4, 5]), (35, [5, 6]),
        (36, [6, 7]), (37, [7, 8]), (38, [8, 9]), (39, [9, 10]), (40, [10, 1]), (41, [1, 2]), (42, [2, 3]), (43, [3, 4]), (44, [4, 5]), (45, [5, 6]),
        (46, [6, 7]), (47, [7, 8]), (48, [8, 9]), (49, [9, 10]), (50, [10, 1]), (51, [1, 2]), (52, [2, 3]), (53, [3, 4]), (54, [4, 5]), (55, [5, 6]),
        (56, [6, 7]), (57, [7, 8]), (58, [8, 9]), (59, [9, 10]), (60, [10, 1]), (61, [1, 2]), (62, [2, 3]), (63, [3, 4]), (64, [4, 5]), (65, [5, 6]),
        (66, [6, 7]), (67, [7, 8]), (68, [8, 9]), (69, [9, 10]), (70, [10, 1]), (71, [1, 2]), (72, [2, 3]), (73, [3, 4]), (74, [4, 5]), (75, [5, 6]),
        (76, [6, 7]), (77, [7, 8]), (78, [8, 9]), (79, [9, 10]), (80, [10, 1]), (81, [1, 2]), (82, [2, 3]), (83, [3, 4]), (84, [4, 5]), (85, [5, 6]),
        (86, [6, 7]), (87, [7, 8]), (88, [8, 9]), (89, [9, 10]), (90, [10, 1]), (91, [1, 2]), (92, [2, 3]), (93, [3, 4]), (94, [4, 5]), (95, [5, 6]),
        (96, [6, 7]), (97, [7, 8]), (98, [8, 9]), (99, [9, 10]), (100, [10, 1]), (101, [1, 2]), (102, [2, 3]), (103, [3, 4]), (104, [4, 5]), (105, [5, 6]),
        (106, [6, 7]), (107, [7, 8]), (108, [8, 9]), (109, [9, 10]), (110, [10, 1]), (111, [1, 2]), (112, [2, 3]), (113, [3, 4]), (114, [4, 5]), (115, [5, 6]),
        (116, [6, 7]), (117, [7, 8]), (118, [8, 9]), (119, [9, 10]), (120, [10, 1]), (121, [1, 2]), (122, [2, 3]), (123, [3, 4]), (124, [4, 5]), (125, [5, 6]),
        (126, [6, 7]), (127, [7, 8]), (128, [8, 9]), (129, [9, 10]), (130, [10, 1]), (131, [1, 2]), (132, [2, 3]), (133, [3, 4]), (134, [4, 5]), (135, [5, 6]),
        (136, [6, 7]), (137, [7, 8]), (138, [8, 9]), (139, [9, 10]), (140, [10, 1]), (141, [1, 2]), (142, [2, 3]), (143, [3, 4]), (144, [4, 5]), (145, [5, 6]),
        (146, [6, 7]), (147, [7, 8]), (148, [8, 9]), (149, [9, 10]), (150, [10, 1]), (151, [1, 2]), (152, [2, 3]), (153, [3, 4]), (154, [4, 5]), (155, [5, 6]),
        (156, [6, 7]), (157, [7, 8]), (158, [8, 9]), (159, [9, 10]), (160, [10, 1]), (161, [1, 2]), (162, [2, 3]), (163, [3, 4]), (164, [4, 5]), (165, [5, 6]),
        (166, [6, 7]), (167, [7, 8]), (168, [8, 9]), (169, [9, 10]), (170, [10, 1]), (171, [1, 2]), (172, [2, 3]), (173, [3, 4]), (174, [4, 5]), (175, [5, 6]),
        (176, [6, 7]), (177, [7, 8]), (178, [8, 9]), (179, [9, 10]), (180, [10, 1]), (181, [1, 2]), (182, [2, 3]), (183, [3, 4]), (184, [4, 5]), (185, [5, 6]),
        (186, [6, 7]), (187, [7, 8]), (188, [8, 9]), (189, [9, 10]), (190, [10, 1]), (191, [1, 2]), (192, [2, 3]), (193, [3, 4]), (194, [4, 5]), (195, [5, 6]),
        (196, [6, 7]), (197, [7, 8]), (198, [8, 9]), (199, [9, 10]), (200, [10, 1]), (201, [1, 2]), (202, [2, 3]), (203, [3, 4]), (204, [4, 5]), (205, [5, 6]),
        (206, [6, 7]), (207, [7, 8]), (208, [8, 9]), (209, [9, 10]), (210, [10, 1]), (211, [1, 2]), (212, [2, 3]), (213, [3, 4]), (214, [4, 5]), (215, [5, 6]),
        (216, [6, 7]), (217, [7, 8]), (218, [8, 9]), (219, [9, 10]), (220, [10, 1]), (221, [1, 2]), (222, [2, 3]), (223, [3, 4]), (224, [4, 5]), (225, [5, 6]),
        (226, [6, 7]), (227, [7, 8]), (228, [8, 9]), (229, [9, 10]), (230, [10, 1]), (231, [1, 2]), (232, [2, 3]), (233, [3, 4]), (234, [4, 5]), (235, [5, 6]),
        (236, [6, 7]), (237, [7, 8]), (238, [8, 9]), (239, [9, 10]), (240, [10, 1]), (241, [1, 2]), (242, [2, 3]), (243, [3, 4]), (244, [4, 5]), (245, [5, 6]),
        (246, [6, 7]), (247, [7, 8]), (248, [8, 9]), (249, [9, 10]), (250, [10, 1]), (251, [1, 2]), (252, [2, 3]), (253, [3, 4]), (254, [4, 5]), (255, [5, 6]),
        (256, [6, 7]), (257, [7, 8]), (258, [8, 9]), (259, [9, 10]), (260, [10, 1]), (261, [1, 2]), (262, [2, 3]), (263, [3, 4]), (264, [4, 5]), (265, [5, 6]),
        (266, [6, 7]), (267, [7, 8]), (268, [8, 9]), (269, [9, 10]), (270, [10, 1]), (271, [1, 2]), (272, [2, 3]), (273, [3, 4]), (274, [4, 5]), (275, [5, 6]),
    ]
    
    total_type_time_without = 0
    total_type_time_with = 0
    
    for attacking_type, defending_types in type_combinations:
        result5, time5 = measure_performance(get_type_effectiveness, "get_type_effectiveness", attacking_type, defending_types)
        total_type_time_without += time5
        result6, time6 = measure_performance(cached_get_type_effectiveness, "cached_get_type_effectiveness", attacking_type, defending_types)
        total_type_time_with += time6
    
    print(f"     Total type time without cache: {total_type_time_without:.2f}ms")
    print(f"     Total type time with cache: {total_type_time_with:.2f}ms")
    
    # Calculate overall improvement
    total_without = total_time_without_cache + total_move_time_without + total_type_time_without
    total_with = total_time_with_cache + total_move_time_with + total_type_time_with
    
    if total_without > 0:
        improvement = ((total_without - total_with) / total_without) * 100
        print(f"   Overall battle data improvement: {improvement:.1f}%")
    
    return True

def test_repeated_lookups():
    print("\n🔄 Testing repeated lookups performance...")
    
    # Test the same Pokemon being looked up multiple times
    pokemon_id = 25  # Pikachu
    iterations = 10000
    
    print(f"   Testing {iterations} repeated lookups of Pokemon {pokemon_id}...")
    
    print("   Without cache (repeated database queries)...")
    total_time1, avg_time1 = bulk_performance_test_memory_optimized(fetch_pokemon_by_id, "fetch_pokemon_by_id", iterations, pokemon_id)
    print(f"   Total time: {total_time1:.2f}ms, Avg: {avg_time1:.2f}ms")
    
    print("   With cache (first call hits DB, rest hit cache)...")
    total_time2, avg_time2 = bulk_performance_test_memory_optimized(cached_fetch_pokemon_by_id, "cached_fetch_pokemon_by_id", iterations, pokemon_id)
    print(f"   Total time: {total_time2:.2f}ms, Avg: {avg_time2:.2f}ms")
    
    if total_time1 > 0:
        improvement = ((total_time1 - total_time2) / total_time1) * 100
        print(f"   Performance improvement: {improvement:.1f}%")
    
    return iterations

def test_filtered_queries():
    print("\n🔍 Testing filtered queries performance...")
    
    # Test multiple different filter combinations
    filter_combinations = [
        {'search': 'pikachu', 'cost': 3, 'types': 'electric'},
        {'search': 'char', 'cost': 4, 'types': 'fire'},
        {'search': 'squirtle', 'cost': 2, 'types': 'water'},
        {'search': 'bulba', 'cost': 3, 'types': 'grass'},
        {'search': 'mew', 'cost': 5, 'types': 'psychic'},
        {'cost': 1, 'types': 'normal'},
        {'cost': 2, 'types': 'fighting'},
        {'cost': 3, 'types': 'flying'},
        {'cost': 4, 'types': 'poison'},
        {'cost': 5, 'types': 'ground'}
    ]
    
    print(f"   Testing {len(filter_combinations)} different filter combinations...")
    
    total_time_without_cache = 0
    total_time_with_cache = 0
    
    for filters in filter_combinations:
        result1, time1 = measure_performance(fetch_pokemon, "fetch_pokemon", filters)
        total_time_without_cache += time1
        result2, time2 = measure_performance(cached_fetch_pokemon, "cached_fetch_pokemon", filters)
        total_time_with_cache += time2
    
    print(f"   Total time without cache: {total_time_without_cache:.2f}ms")
    print(f"   Total time with cache: {total_time_with_cache:.2f}ms")
    
    if total_time_without_cache > 0:
        improvement = ((total_time_without_cache - total_time_with_cache) / total_time_without_cache) * 100
        print(f"   Performance improvement: {improvement:.1f}%")
    
    return len(filter_combinations)

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


def test_stress_performance():
    print("\n💪 Testing stress performance (mixed operations)...")
    
    # Simulate realistic application usage with mixed operations
    operations = []
    
    # Add Pokemon list queries
    for _ in range(20):
        operations.append(('pokemon_list', None))
    
    # Add individual Pokemon lookups
    for pokemon_id in range(1, 31):
        operations.append(('pokemon_detail', pokemon_id))
    
    # Add move lookups
    for move_id in range(1, 21):
        operations.append(('move', move_id))
    
    # Add type effectiveness calculations
    for i in range(20):
        attacking_type = (i % 10) + 1
        defending_types = [(i % 5) + 1, (i % 5) + 6]
        operations.append(('type_effectiveness', (attacking_type, defending_types)))
    
    # Shuffle operations to simulate random access patterns
    random.shuffle(operations)
    
    print(f"   Testing {len(operations)} mixed operations...")
    
    # Test without cache
    start_time = time.time()
    for op_type, params in operations:
        if op_type == 'pokemon_list':
            fetch_pokemon()
        elif op_type == 'pokemon_detail':
            fetch_pokemon_by_id(params)
        elif op_type == 'move':
            get_move_data(params)
        elif op_type == 'type_effectiveness':
            get_type_effectiveness(params[0], params[1])
    end_time = time.time()
    total_time_without_cache = (end_time - start_time) * 1000
    
    # Test with cache
    start_time = time.time()
    for op_type, params in operations:
        if op_type == 'pokemon_list':
            cached_fetch_pokemon()
        elif op_type == 'pokemon_detail':
            cached_fetch_pokemon_by_id(params)
        elif op_type == 'move':
            cached_get_move_data(params)
        elif op_type == 'type_effectiveness':
            cached_get_type_effectiveness(params[0], params[1])
    end_time = time.time()
    total_time_with_cache = (end_time - start_time) * 1000
    
    print(f"   Total time without cache: {total_time_without_cache:.2f}ms")
    print(f"   Total time with cache: {total_time_with_cache:.2f}ms")
    
    if total_time_without_cache > 0:
        improvement = ((total_time_without_cache - total_time_with_cache) / total_time_without_cache) * 100
        print(f"   Performance improvement: {improvement:.1f}%")
    
    return len(operations)

def main():
    print("🚀 Enhanced Redis Cache Test Suite for Pikapi (Memory Optimized)")
    print("=" * 70)
    
    if not test_cache_connection():
        print("\n❌ Cannot proceed without Redis connection")
        print("Please start Redis server and try again")
        return
    
    test_pokemon_list_performance()
    
    test_individual_pokemon_performance()
    
    test_battle_data_performance()
    
    test_repeated_lookups()
    
    test_filtered_queries()
    
    test_stress_performance()
    
    test_cache_warming()
    
    test_cache_management()
    
    print("\n" + "=" * 70)
    print("✅ Enhanced Redis cache test suite completed!")
    print("\n📈 Expected Performance Improvements with Many Operations:")
    print("   • Pokemon list queries: 85-95% faster")
    print("   • Individual Pokemon lookups: 90-95% faster")
    print("   • Battle calculations: 80-90% faster")
    print("   • Repeated lookups: 95-99% faster")
    print("   • Mixed operations: 85-90% faster")
    print("\n🔧 Cache Dashboard available at: http://localhost:5000/cache")
    print("\n💡 Memory optimization: Results are not stored in memory to prevent OOM")

if __name__ == "__main__":
    main() 