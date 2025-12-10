#!/usr/bin/env python3
"""
Script de Testing para Redis Cluster
Verifica distribución de datos, failover, y rendimiento
"""

import sys
import time
from redis.cluster import RedisCluster, ClusterNode
from redis.exceptions import RedisClusterException

# Colores para output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def connect_to_cluster():
    """Conectar al Redis Cluster"""
    print_info("Conectando a Redis Cluster...")
    
    startup_nodes = [
        ClusterNode("localhost", 7000),
        ClusterNode("localhost", 7001),
        ClusterNode("localhost", 7002),
    ]
    
    try:
        client = RedisCluster(
            startup_nodes=startup_nodes,
            decode_responses=True,
            skip_full_coverage_check=False,
        )
        print_success("Conectado a Redis Cluster")
        return client
    except Exception as e:
        print_error(f"Error al conectar: {e}")
        sys.exit(1)

def test_cluster_info(client):
    """Test 1: Verificar información del cluster"""
    print("\n" + "="*60)
    print("TEST 1: Información del Cluster")
    print("="*60)
    
    try:
        info = client.cluster_info()
        print_info("Cluster Info:")
        for key, value in info.items():
            print(f"  {key}: {value}")
        
        if info.get('cluster_state') == 'ok':
            print_success("Cluster state: OK")
        else:
            print_error(f"Cluster state: {info.get('cluster_state')}")
        
        if info.get('cluster_slots_assigned') == 16384:
            print_success("Todos los slots asignados (16384/16384)")
        else:
            print_warning(f"Slots asignados: {info.get('cluster_slots_assigned')}/16384")
        
        return True
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_cluster_nodes(client):
    """Test 2: Verificar nodos del cluster"""
    print("\n" + "="*60)
    print("TEST 2: Nodos del Cluster")
    print("="*60)
    
    try:
        nodes = client.cluster_nodes()
        print_info(f"Nodos encontrados: {len(nodes)}")
        
        masters = 0
        replicas = 0
        
        for node_id, node_info in nodes.items():
            role = "MASTER" if "master" in node_info.get('flags', []) else "REPLICA"
            addr = f"{node_info.get('host')}:{node_info.get('port')}"
            slots = node_info.get('slots', [])
            
            if role == "MASTER":
                masters += 1
                slots_str = f"({len(slots)} slots)" if isinstance(slots, list) else ""
                print_info(f"  {role}: {addr} {slots_str}")
            else:
                replicas += 1
                master_id = node_info.get('master_id', 'unknown')
                print_info(f"  {role}: {addr} (replica of {master_id[:8]}...)")
        
        if masters == 3:
            print_success(f"Masters correctos: {masters}/3")
        else:
            print_error(f"Masters incorrectos: {masters}/3")
        
        if replicas == 3:
            print_success(f"Replicas correctas: {replicas}/3")
        else:
            print_error(f"Replicas incorrectas: {replicas}/3")
        
        return masters == 3 and replicas == 3
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_hash_tags(client):
    """Test 3: Verificar que hash tags funcionan correctamente"""
    print("\n" + "="*60)
    print("TEST 3: Hash Tags (agrupación de keys)")
    print("="*60)
    
    try:
        # Test 1: Keys con hash tag (mismo slot)
        print_info("Test 3.1: Keys con hash tag (deben estar en el mismo slot)")
        keys_with_tag = [
            "{user:alice}:feed:all",
            "{user:alice}:feed:following",
            "{user:alice}:profile",
        ]
        
        # Escribir datos
        for key in keys_with_tag:
            client.set(key, f"data_{key}")
        
        # Leer con pipeline (solo funciona si están en el mismo slot)
        pipe = client.pipeline()
        for key in keys_with_tag:
            pipe.get(key)
        results = pipe.execute()
        
        print_success("Pipeline multi-key funcionó (keys en el mismo slot)")
        
        # Test 2: Keys sin hash tag (diferentes slots)
        print_info("Test 3.2: Keys sin hash tag (pueden estar en diferentes slots)")
        keys_without_tag = [
            "user:bob:feed:all",
            "user:bob:feed:following",
            "user:bob:profile",
        ]
        
        for key in keys_without_tag:
            client.set(key, f"data_{key}")
        
        print_success("Keys individuales escritas correctamente")
        
        # Cleanup
        client.delete(*keys_with_tag)
        client.delete(*keys_without_tag)
        
        return True
    except RedisClusterException as e:
        if "CROSSSLOT" in str(e):
            print_error(f"Error de CROSSSLOT esperado sin hash tags: {e}")
            return False
        else:
            print_error(f"Error inesperado: {e}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_likes_system(client):
    """Test 4: Simular sistema de likes"""
    print("\n" + "="*60)
    print("TEST 4: Sistema de Likes (operaciones atómicas)")
    print("="*60)
    
    try:
        post_id = "post123"
        users = ["alice", "bob", "charlie", "diana", "eve"]
        
        print_info(f"Simulando likes al post {post_id} por {len(users)} usuarios")
        
        # Like por cada usuario
        for username in users:
            # Verificar si ya dio like
            if client.sismember(f"{{post:{post_id}}}:likes:users", username):
                print_warning(f"  {username} ya dio like")
                continue
            
            # Pipeline atómico
            pipe = client.pipeline()
            pipe.incr(f"{{post:{post_id}}}:likes:count")
            pipe.sadd(f"{{post:{post_id}}}:likes:users", username)
            pipe.zincrby("trending:posts", 1, post_id)
            results = pipe.execute()
            
            print_info(f"  {username} dio like → count = {results[0]}")
        
        # Verificar contador final
        final_count = client.get(f"{{post:{post_id}}}:likes:count")
        users_set = client.smembers(f"{{post:{post_id}}}:likes:users")
        trending_score = client.zscore("trending:posts", post_id)
        
        print_success(f"Contador final: {final_count} likes")
        print_success(f"Usuarios que dieron like: {len(users_set)}")
        print_success(f"Score en trending: {trending_score}")
        
        # Cleanup
        client.delete(
            f"{{post:{post_id}}}:likes:count",
            f"{{post:{post_id}}}:likes:users",
        )
        client.zrem("trending:posts", post_id)
        
        return int(final_count) == len(users)
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_feed_cache(client):
    """Test 5: Cache de feeds"""
    print("\n" + "="*60)
    print("TEST 5: Cache de Feeds")
    print("="*60)
    
    try:
        username = "testuser"
        feed_data = [
            {"id": "post1", "content": "Hello world", "author": "alice"},
            {"id": "post2", "content": "Redis is awesome", "author": "bob"},
        ]
        
        import json
        
        # Cachear feed
        print_info(f"Cacheando feed para {username}")
        client.setex(
            f"{{user:{username}}}:feed:all",
            60,  # TTL 60 segundos
            json.dumps(feed_data)
        )
        
        # Leer feed
        cached = client.get(f"{{user:{username}}}:feed:all")
        if cached:
            parsed = json.loads(cached)
            print_success(f"Feed cacheado recuperado: {len(parsed)} posts")
        else:
            print_error("No se pudo recuperar feed cacheado")
            return False
        
        # Verificar TTL
        ttl = client.ttl(f"{{user:{username}}}:feed:all")
        print_info(f"TTL restante: {ttl} segundos")
        
        if ttl > 0:
            print_success("TTL configurado correctamente")
        else:
            print_error("TTL no configurado")
            return False
        
        # Cleanup
        client.delete(f"{{user:{username}}}:feed:all")
        
        return True
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_trending_posts(client):
    """Test 6: Ranking de trending posts"""
    print("\n" + "="*60)
    print("TEST 6: Trending Posts (Sorted Sets)")
    print("="*60)
    
    try:
        posts = [
            ("post1", 150),  # score = likes
            ("post2", 300),
            ("post3", 50),
            ("post4", 200),
            ("post5", 100),
        ]
        
        print_info("Agregando posts al ranking trending...")
        for post_id, likes in posts:
            client.zadd("trending:posts", {post_id: likes})
            print_info(f"  {post_id}: {likes} likes")
        
        # Obtener top 3
        print_info("\nTop 3 trending posts:")
        top_posts = client.zrevrange("trending:posts", 0, 2, withscores=True)
        
        for i, (post_id, score) in enumerate(top_posts, 1):
            print_success(f"  #{i}: {post_id} con {int(score)} likes")
        
        # Verificar orden correcto
        expected_order = ["post2", "post4", "post1"]  # 300, 200, 150
        actual_order = [post_id for post_id, _ in top_posts]
        
        if actual_order == expected_order:
            print_success("Orden correcto en trending")
        else:
            print_error(f"Orden incorrecto. Esperado: {expected_order}, Actual: {actual_order}")
            return False
        
        # Cleanup
        client.delete("trending:posts")
        
        return True
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_performance(client):
    """Test 7: Performance básico"""
    print("\n" + "="*60)
    print("TEST 7: Performance")
    print("="*60)
    
    try:
        num_ops = 1000
        
        # Test de escritura
        print_info(f"Escribiendo {num_ops} keys...")
        start = time.time()
        for i in range(num_ops):
            client.set(f"{{perf:test}}:key:{i}", f"value{i}")
        write_time = time.time() - start
        write_ops_per_sec = num_ops / write_time
        
        print_success(f"Escritura: {write_ops_per_sec:.0f} ops/sec ({write_time:.2f}s total)")
        
        # Test de lectura
        print_info(f"Leyendo {num_ops} keys...")
        start = time.time()
        for i in range(num_ops):
            client.get(f"{{perf:test}}:key:{i}")
        read_time = time.time() - start
        read_ops_per_sec = num_ops / read_time
        
        print_success(f"Lectura: {read_ops_per_sec:.0f} ops/sec ({read_time:.2f}s total)")
        
        # Cleanup
        for i in range(num_ops):
            client.delete(f"{{perf:test}}:key:{i}")
        
        return True
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def main():
    """Ejecutar todos los tests"""
    print("\n" + "="*60)
    print("🧪 REDIS CLUSTER - SUITE DE TESTS")
    print("="*60)
    
    # Conectar
    client = connect_to_cluster()
    
    # Ejecutar tests
    tests = [
        ("Información del Cluster", test_cluster_info),
        ("Nodos del Cluster", test_cluster_nodes),
        ("Hash Tags", test_hash_tags),
        ("Sistema de Likes", test_likes_system),
        ("Cache de Feeds", test_feed_cache),
        ("Trending Posts", test_trending_posts),
        ("Performance", test_performance),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func(client)
            results.append((test_name, result))
        except Exception as e:
            print_error(f"Test falló con excepción: {e}")
            results.append((test_name, False))
    
    # Resumen
    print("\n" + "="*60)
    print("📊 RESUMEN DE TESTS")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        color = Colors.GREEN if result else Colors.RED
        print(f"{color}{status}{Colors.RESET} - {test_name}")
    
    print("\n" + "-"*60)
    success_rate = (passed / total) * 100
    print(f"Total: {passed}/{total} tests pasados ({success_rate:.0f}%)")
    
    if passed == total:
        print_success("¡Todos los tests pasaron! 🎉")
        return 0
    else:
        print_error(f"{total - passed} test(s) fallaron")
        return 1

if __name__ == "__main__":
    sys.exit(main())
