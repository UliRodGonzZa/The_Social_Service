# 🏗️ ARQUITECTURA REDIS CLUSTER - RED K

## 📋 Resumen Ejecutivo

Redis Cluster con **3 masters + 3 replicas** para sharding y alta disponibilidad en la red social Red K.

- **Total slots:** 16,384 (distribuidos en 3 masters)
- **Replicación:** 1 réplica por master
- **Failover:** Automático con votación de mayoría
- **Persistencia:** AOF (Append-Only File)
- **Eviction:** LRU (allkeys-lru) cuando se alcanza maxmemory

---

## 🗺️ Topología del Cluster

```
┌─────────────────────────────────────────────────────────────┐
│                    REDIS CLUSTER                             │
│                   (6 nodos en total)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │  Master 1       │────────▶│  Replica 1      │          │
│  │  Port: 7000     │         │  Port: 7003     │          │
│  │  Slots: 0-5460  │◀────────│  (backup de M1) │          │
│  └─────────────────┘         └─────────────────┘          │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │  Master 2       │────────▶│  Replica 2      │          │
│  │  Port: 7001     │         │  Port: 7004     │          │
│  │  Slots: 5461    │◀────────│  (backup de M2) │          │
│  │       -10922    │         │                 │          │
│  └─────────────────┘         └─────────────────┘          │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │  Master 3       │────────▶│  Replica 3      │          │
│  │  Port: 7002     │         │  Port: 7005     │          │
│  │  Slots: 10923   │◀────────│  (backup de M3) │          │
│  │       -16383    │         │                 │          │
│  └─────────────────┘         └─────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Distribución de Hash Slots:**
- **Master 1:** 5,461 slots (33.3% de los datos)
- **Master 2:** 5,462 slots (33.4% de los datos)
- **Master 3:** 5,461 slots (33.3% de los datos)

---

## 🗝️ Estrategia de Key Naming (Hash Tags)

### ¿Por qué Hash Tags?

Redis Cluster calcula `CRC16(key) mod 16384` para determinar en qué slot (y por tanto, en qué master) se almacena una key.

Con **hash tags `{...}`**, solo se hashea la parte entre llaves, permitiendo:
- ✅ Agrupar keys relacionadas en el mismo slot
- ✅ Operaciones multi-key (pipelines, Lua scripts)
- ✅ Atomicidad en operaciones relacionadas

### Convención de Naming

```bash
# ✅ CORRECTO - Todas las keys del usuario en el mismo slot
{user:alice}:feed:all
{user:alice}:feed:following
{user:alice}:profile
{user:alice}:suggestions
{user:alice}:conversations

# ✅ CORRECTO - Todas las keys del post en el mismo slot
{post:abc123}:likes:count
{post:abc123}:likes:users
{post:abc123}:comments

# ✅ CORRECTO - Conversación agrupada (ordenar usernames alfabéticamente)
{conv:alice::bob}:messages

# ❌ INCORRECTO - Keys en diferentes slots
user:alice:feed              # slot X
user:alice:profile           # slot Y (no se puede hacer MGET)
```

### Keys Globales (sin hash tag)

```bash
# Sin hash tag porque son globales (cualquier slot está bien)
trending:posts                # ZSET - ranking global
trending:posts:1h
trending:posts:24h
global:stats:posts_count
global:stats:users_count
```

---

## 📊 Distribución de Datos por Caso de Uso

### 1️⃣ Cache de Feeds de Posts

**Keys:**
```bash
{user:{username}}:feed:all           # Feed completo (propios + seguidos)
{user:{username}}:feed:following     # Solo posts de seguidos
{user:{username}}:feed:self          # Solo posts propios
```

**Estructura:** LIST de JSON strings (posts serializados)

**TTL:** 60 segundos

**Razón del TTL:**
- Alta volatilidad: nuevos posts aparecen constantemente
- Bajo costo de reconstrucción desde MongoDB + Neo4j
- Se invalida al crear post, seguir o dejar de seguir

**Distribución:**
- Cada username se hashea independientemente
- Ejemplo: `alice` → M1, `bob` → M3, `charlie` → M2

**Invalidación:**
```python
# Al crear un post
redis.delete(f"{{user:{author_username}}}:feed:all")
redis.delete(f"{{user:{author_username}}}:feed:self")

# Al seguir a alguien
redis.delete(f"{{user:{follower_username}}}:feed:all")
redis.delete(f"{{user:{follower_username}}}:feed:following")
```

---

### 2️⃣ Sistema de Likes y Trending

**Keys:**
```bash
# Agrupadas por post
{post:{post_id}}:likes:count         # STRING - INCR/DECR
{post:{post_id}}:likes:users         # SET de usernames

# Globales (rankings)
trending:posts                        # ZSET: score=likes, member=post_id
trending:posts:1h                     # Trending última hora
trending:posts:24h                    # Trending últimas 24h
```

**TTL:**
- `likes:count`: **SIN TTL** (métrica persistente, se sincroniza a MongoDB)
- `likes:users`: **SIN TTL** (necesario para prevenir doble-like)
- `trending:*`: **300 segundos** (5 minutos, se recalcula periódicamente)

**Flujo de Like (atomicidad con Pipeline):**
```python
# Verificar si ya dio like
if redis.sismember(f"{{post:{post_id}}}:likes:users", username):
    return {"error": "Ya diste like"}

# Pipeline atómico
pipe = redis.pipeline()
pipe.incr(f"{{post:{post_id}}}:likes:count")              # +1 contador
pipe.sadd(f"{{post:{post_id}}}:likes:users", username)    # agregar usuario
pipe.zincrby("trending:posts", 1, post_id)                # +1 en trending
pipe.execute()

# Sincronizar a MongoDB (async, eventual)
background_task.add(sync_likes_to_mongo, post_id)
```

**Distribución:**
- Cada post cae en un slot específico según su ID
- Trending es global (puede estar en cualquier master)

**Sincronización a MongoDB:**
```python
# Job cada 5 minutos (Celery/cron)
def sync_likes_to_mongo():
    for post_id in redis.scan_iter("{post:*}:likes:count"):
        count = redis.get(post_id)
        mongo.posts.update_one(
            {"_id": post_id},
            {"$set": {"likes_count": count}}
        )
```

---

### 3️⃣ Cache de Comentarios

**Keys:**
```bash
{post:{post_id}}:comments           # LIST de comentarios (JSON)
{post:{post_id}}:comments:count     # Contador rápido
```

**Estructura:**
```json
[
  {
    "id": "comment_123",
    "author": "alice",
    "content": "Great post!",
    "created_at": "2025-01-15T10:30:00Z",
    "replies_count": 2
  }
]
```

**TTL:** 120 segundos

**Razón:**
- Los comentarios cambian menos frecuentemente que el feed
- TTL moderado reduce carga en MongoDB
- Se invalida al agregar nuevo comentario

**Distribución:**
- Comentarios agrupados con su post (mismo slot)
- Permite pipeline atómico: `LPUSH` + `INCR`

---

### 4️⃣ Cache de Mensajes Directos (DMs)

**Keys:**
```bash
# Conversación entre dos usuarios (ordenar alfabéticamente)
{conv:{user1}::{user2}}:messages      # LIST de mensajes
{conv:{user1}::{user2}}:unread        # Contador de no leídos

# Lista de conversaciones por usuario
{user:{username}}:conversations       # ZSET: score=timestamp, member=other_username
```

**TTL:**
- `messages`: 300 segundos (5 minutos)
- `conversations`: 600 segundos (10 minutos)

**Distribución:**
- Conversaciones se distribuyen por hash de la clave compuesta
- Ejemplo: `{conv:alice::bob}` → slot basado en "conv:alice::bob"

---

### 5️⃣ Cache de Recomendaciones

**Keys:**
```bash
{user:{username}}:suggestions       # LIST de usuarios sugeridos (JSON)
```

**Estructura:**
```json
[
  {
    "username": "bob",
    "score": 15.0,
    "mutual_connections": 3,
    "followers_count": 120
  }
]
```

**TTL:** 600 segundos (10 minutos)

**Razón:**
- Las sugerencias son **muy costosas** de calcular en Neo4j (traversals)
- TTL largo porque no cambian frecuentemente
- Se invalida al seguir/dejar de seguir

---

## ⚙️ Failover Automático

### Proceso de Failover

```
┌──────────────────────────────────────────────────────┐
│  ESCENARIO: Master 1 (puerto 7000) FALLA             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  t=0s:   Master 1 deja de responder PINGs           │
│                                                      │
│  t=15s:  Replica 1 detecta timeout                  │
│          (cluster-node-timeout=15000ms)             │
│                                                      │
│  t=16s:  Replica 1 inicia votación:                 │
│          "¿Puedo ser el nuevo master?"              │
│                                                      │
│  t=17s:  Masters 2 y 3 votan SÍ                     │
│          (mayoría: 2/3 masters activos)             │
│                                                      │
│  t=18s:  Replica 1 se PROMUEVE a Master             │
│          Asume slots 0-5460                         │
│                                                      │
│  t=19s:  Cluster actualiza tabla de slots:          │
│          MOVED 1234 redis-replica-1:7003            │
│                                                      │
│  t=20s+: Clientes reciben MOVED redirects           │
│          y actualizan su tabla interna              │
│                                                      │
│  t=Xmin: Cuando Master 1 vuelve:                    │
│          Se convierte en REPLICA de Replica 1       │
│          (que ahora es el master)                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Garantías de Consistencia

**✅ Lo que Redis Cluster GARANTIZA:**
- **Alta disponibilidad:** Cluster funciona con mayoría de masters (2/3 en este caso)
- **Particionamiento automático:** Slots se redistribuyen sin intervención manual
- **Eventual consistency:** Réplicas alcanzan eventualmente al master

**⚠️ Limitaciones:**
- **Escrituras perdidas:** Si master falla antes de replicar a la réplica, esas escrituras se pierden
- **No es CP (Consistency + Partition tolerance):** Es **AP** (Availability + Partition tolerance) según CAP theorem
- **Split-brain posible:** En partición de red, pueden existir temporalmente 2 masters para el mismo slot

### Configuración de Failover

```bash
# En redis.conf o via command line
cluster-node-timeout 15000           # 15 segundos para detectar fallo
cluster-replica-validity-factor 10   # Réplica debe estar actualizada
cluster-require-full-coverage no     # Seguir operando si faltan slots (degrada)
```

**Cálculo del tiempo de failover:**
```
Tiempo mínimo = cluster-node-timeout + votación + promoción
               ≈ 15s + 2s + 1s = ~18 segundos
```

---

## 🔌 Integración con Backend (Python)

### Instalación de Dependencias

```bash
# requirements.txt
redis[hiredis]>=5.0.0
```

### Configuración del Cliente

```python
# backend/app/redis_cluster.py

from redis.cluster import RedisCluster
from redis.cluster import ClusterNode
import os
import json

class RedisClusterManager:
    def __init__(self):
        # Nodos iniciales (solo necesitas 1-2, auto-discovery encuentra el resto)
        startup_nodes = [
            ClusterNode(os.getenv("REDIS_MASTER_1_HOST", "redis-master-1"), 7000),
            ClusterNode(os.getenv("REDIS_MASTER_2_HOST", "redis-master-2"), 7001),
            ClusterNode(os.getenv("REDIS_MASTER_3_HOST", "redis-master-3"), 7002),
        ]
        
        self.client = RedisCluster(
            startup_nodes=startup_nodes,
            decode_responses=True,
            skip_full_coverage_check=False,      # Verificar cobertura completa
            max_connections_per_node=50,         # Pool de conexiones
            read_from_replicas=True,             # Balancear lecturas en réplicas
            reinitialize_steps=10,               # Reintentos si cluster cambia
            cluster_error_retry_attempts=3,      # Reintentos en errores
            socket_connect_timeout=5,            # Timeout de conexión
        )
    
    def get_client(self):
        return self.client
    
    # ====== Helper methods con hash tags ======
    
    def get_user_feed(self, username: str, mode: str = "all"):
        """Get feed cacheado del usuario"""
        key = f"{{user:{username}}}:feed:{mode}"
        cached = self.client.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    def set_user_feed(self, username: str, mode: str, posts: list, ttl: int = 60):
        """Cachear feed del usuario"""
        key = f"{{user:{username}}}:feed:{mode}"
        self.client.setex(key, ttl, json.dumps(posts))
    
    def invalidate_user_feed(self, username: str):
        """Invalidar todos los feeds del usuario"""
        keys = [
            f"{{user:{username}}}:feed:all",
            f"{{user:{username}}}:feed:following",
            f"{{user:{username}}}:feed:self",
        ]
        self.client.delete(*keys)
    
    def increment_post_likes(self, post_id: str, username: str) -> int:
        """Incrementar likes de un post (atomico con pipeline)"""
        # Verificar si ya dio like
        if self.client.sismember(f"{{post:{post_id}}}:likes:users", username):
            return -1  # Ya dio like
        
        # Pipeline atómico
        pipe = self.client.pipeline()
        pipe.incr(f"{{post:{post_id}}}:likes:count")
        pipe.sadd(f"{{post:{post_id}}}:likes:users", username)
        pipe.zincrby("trending:posts", 1, post_id)
        results = pipe.execute()
        
        return results[0]  # Nuevo contador
    
    def get_trending_posts(self, limit: int = 10):
        """Obtener posts trending (más likeados)"""
        # ZREVRANGE con scores
        posts = self.client.zrevrange("trending:posts", 0, limit - 1, withscores=True)
        return [{"post_id": post_id, "likes": int(score)} for post_id, score in posts]

# Instancia global
redis_cluster_manager = RedisClusterManager()
```

### Uso en Endpoints

```python
# backend/app/main.py

from redis_cluster import redis_cluster_manager

@app.get("/users/{username}/feed")
def get_user_feed(username: str, mode: str = "all"):
    # 1. Intentar desde cache
    cached_feed = redis_cluster_manager.get_user_feed(username, mode)
    if cached_feed:
        return {"posts": cached_feed, "from_cache": True}
    
    # 2. Construir desde DB
    posts = build_feed_from_db(username, mode)
    
    # 3. Cachear resultado
    redis_cluster_manager.set_user_feed(username, mode, posts, ttl=60)
    
    return {"posts": posts, "from_cache": False}

@app.post("/posts/{post_id}/like")
def like_post(post_id: str, username: str):
    # Like en Redis Cluster (atómico)
    new_count = redis_cluster_manager.increment_post_likes(post_id, username)
    
    if new_count == -1:
        raise HTTPException(400, "Ya diste like a este post")
    
    # Sincronizar a MongoDB (async)
    background_tasks.add_task(sync_like_to_mongo, post_id, new_count)
    
    return {"likes_count": new_count}
```

---

## 🚫 Operaciones a Evitar en Redis Cluster

### ❌ Multi-key en Diferentes Slots

```python
# ❌ FALLA: keys en diferentes slots
pipe = redis.pipeline()
pipe.get("user:alice:feed")      # Slot X
pipe.get("user:bob:feed")        # Slot Y
pipe.execute()
# ERROR: CROSSSLOT Keys in request don't hash to the same slot
```

**✅ SOLUCIÓN 1: Hash Tags**
```python
pipe = redis.pipeline()
pipe.get("{user:alice}:feed")      # Mismo slot
pipe.get("{user:alice}:profile")   # Mismo slot
pipe.execute()  # OK
```

**✅ SOLUCIÓN 2: Operaciones Individuales**
```python
feed_alice = redis.get("{user:alice}:feed")
feed_bob = redis.get("{user:bob}:feed")
```

### ❌ MULTI/EXEC sobre Múltiples Slots

```python
# ❌ No funciona en cluster
redis.multi()
redis.set("key1", "val1")  # Slot X
redis.set("key2", "val2")  # Slot Y
redis.exec()  # ERROR
```

**✅ SOLUCIÓN: Lua Scripts (se ejecutan en un solo nodo)**
```python
script = """
local count = redis.call('INCR', KEYS[1])
redis.call('SADD', KEYS[2], ARGV[1])
return count
"""

result = redis.eval(
    script,
    2,  # número de keys
    f"{{post:{post_id}}}:likes:count",
    f"{{post:{post_id}}}:likes:users",
    username
)
```

---

## 📏 Buenas Prácticas

### TTL Strategy

| Tipo de Dato | TTL | Razón |
|--------------|-----|-------|
| **Feeds** | 60s | Alta volatilidad, fácil reconstruir |
| **Comentarios** | 120s | Cambio moderado |
| **DMs** | 300s | Menos volátiles |
| **Sugerencias** | 600s | Cálculo costoso en Neo4j |
| **Trending** | 300s | Se recalcula periódicamente |
| **Likes count** | ∞ (sin TTL) | Métrica persistente, sincronizar a MongoDB |
| **Likes users** | ∞ | Necesario para prevenir doble-like |

### Sincronización con MongoDB

```python
# Job cada 5 minutos (Celery, cron, APScheduler)
def sync_likes_to_mongodb():
    """Sincronizar contadores de Redis a MongoDB"""
    redis_client = redis_cluster_manager.get_client()
    
    # Escanear todas las keys de likes
    for key in redis_client.scan_iter("{post:*}:likes:count"):
        post_id = key.split(":")[1].strip("{}")
        count = redis_client.get(key)
        
        # Actualizar en MongoDB
        mongo.posts.update_one(
            {"_id": post_id},
            {"$set": {"likes_count": int(count)}}
        )
```

### Monitoreo

```bash
# Conectar al cluster
redis-cli -c -h localhost -p 7000

# Ver estado del cluster
CLUSTER INFO
# Importante:
# - cluster_state: ok
# - cluster_slots_assigned: 16384
# - cluster_known_nodes: 6

# Ver nodos y slots
CLUSTER NODES

# Ver memoria
INFO memory
# - used_memory_human
# - maxmemory_human
# - mem_fragmentation_ratio

# Ver estadísticas
INFO stats
# - total_commands_processed
# - instantaneous_ops_per_sec
# - keyspace_hits / keyspace_misses

# Calcular cache hit rate
hit_rate = keyspace_hits / (keyspace_hits + keyspace_misses) * 100
```

**Alertas Recomendadas:**
- ⚠️ `used_memory > 80%` de `maxmemory` → Aumentar memoria o revisar TTLs
- ⚠️ `mem_fragmentation_ratio > 1.5` → Alta fragmentación, reiniciar nodo
- ⚠️ `hit_rate < 50%` → Cache poco efectivo, revisar estrategia
- 🔴 `cluster_state != ok` → Cluster degradado
- 🔴 `master_link_status: down` en réplica → Replicación rota

---

## 🚀 Cómo Iniciar el Cluster

### Paso 1: Levantar los contenedores

```bash
# Usar el docker-compose con Redis Cluster
docker-compose -f docker-compose-cluster.yml up -d
```

### Paso 2: Verificar el cluster

```bash
# Conectar a cualquier master
docker exec -it redis-master-1 redis-cli -c -p 7000

# Verificar estado
CLUSTER INFO

# Ver distribución de slots
CLUSTER NODES

# Probar una key
SET {user:alice}:feed "test"
GET {user:alice}:feed
```

### Paso 3: Probar failover manual

```bash
# Simular fallo del Master 1
docker stop redis-master-1

# Esperar 15-20 segundos

# Verificar que Replica 1 se promovió
docker exec -it redis-replica-1 redis-cli -c -p 7003 CLUSTER NODES
# Debería mostrar que 7003 ahora es master

# Restaurar Master 1
docker start redis-master-1

# Verificar que ahora es réplica
docker exec -it redis-master-1 redis-cli -c -p 7000 CLUSTER NODES
```

---

## 📚 Referencias

- [Redis Cluster Tutorial](https://redis.io/docs/management/scaling/)
- [Redis Cluster Spec](https://redis.io/docs/reference/cluster-spec/)
- [redis-py Cluster](https://redis-py.readthedocs.io/en/stable/clustering.html)
- [Hash Tags](https://redis.io/docs/reference/cluster-spec/#hash-tags)

---

**Creado para:** Materia de Bases de Datos NoSQL  
**Proyecto:** Red K - Red Social Multi-DB  
**Fecha:** Enero 2025
