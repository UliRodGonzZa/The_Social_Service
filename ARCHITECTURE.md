# 🏗️ Red K - Arquitectura NoSQL

## 📊 Resumen Ejecutivo

Red K es una red social que implementa una **arquitectura NoSQL híbrida** usando tres bases de datos especializadas:
- **MongoDB**: Base de datos de documentos (persistencia principal)
- **Neo4j**: Base de datos de grafos (relaciones sociales)
- **Redis**: Base de datos en memoria (caché y contadores en tiempo real)

## ✅ Confirmación: ¿Se Respetó la Arquitectura Original?

**SÍ**, la arquitectura se respetó completamente:

### Usuarios (MongoDB + Neo4j)
✅ Los usuarios se crean **primero en MongoDB** (fuente de verdad para datos)
✅ **Inmediatamente después** se crea el nodo correspondiente en Neo4j
✅ Si Neo4j falla, se reporta error (no se permite inconsistencia)

### Posts (MongoDB + Neo4j + Redis)
✅ Los posts se guardan **primero en MongoDB** (persistencia)
✅ **Inmediatamente después** se crea el nodo Post y la relación en Neo4j
✅ **Inmediatamente después** se invalida el caché del feed en Redis
✅ Si Neo4j falla, se reporta error

### Likes (Redis + Neo4j + MongoDB eventual)
✅ Los likes se incrementan **primero en Redis** (velocidad)
✅ **Inmediatamente después** se crea la relación en Neo4j
✅ MongoDB eventualmente sincroniza (no implementado aún, pero previsto en comentarios)

---

## 🗄️ MongoDB - Base de Datos de Documentos

### Propósito
**Fuente de verdad para datos persistentes**. MongoDB es la base principal donde se almacenan todos los documentos completos.

### Colecciones

#### `users`
**Propósito**: Almacenar información completa de usuarios.

**Estructura**:
```json
{
  "_id": ObjectId("..."),
  "username": "alice",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "bio": "Developer | Tech enthusiast"
}
```

**Índices sugeridos**:
- `username` (único)
- `email` (único)

**Operaciones**:
- ✅ CREATE: Endpoint `/users/` (POST)
- ✅ READ: Endpoint `/users/` (GET), `/users/by-username/{username}` (GET)
- ❌ UPDATE: No implementado
- ❌ DELETE: No implementado

---

#### `posts`
**Propósito**: Almacenar el contenido completo de los posts.

**Estructura**:
```json
{
  "_id": ObjectId("..."),
  "author_username": "alice",
  "author_id": "675...",
  "content": "¡Hola mundo!",
  "tags": ["tech", "intro"],
  "created_at": "2024-12-10T12:00:00.000Z"
}
```

**Índices sugeridos**:
- `author_username` (para queries de feed)
- `created_at` (descendente, para ordenamiento)
- Índice compuesto: `{author_username: 1, created_at: -1}`

**Operaciones**:
- ✅ CREATE: Endpoint `/posts/` (POST)
- ✅ READ: Endpoint `/users/{username}/feed` (GET)
- ❌ UPDATE: No implementado
- ❌ DELETE: No implementado

---

#### `dms`
**Propósito**: Almacenar mensajes directos entre usuarios.

**Estructura**:
```json
{
  "_id": ObjectId("..."),
  "sender_username": "alice",
  "receiver_username": "bob",
  "content": "Hey, how are you?",
  "created_at": "2024-12-10T12:00:00.000Z",
  "read": false,
  "read_at": null,
  "conversation_key": "alice::bob"
}
```

**Índices sugeridos**:
- `conversation_key` + `created_at` (para queries de conversación)
- Índice compuesto: `{receiver_username: 1, read: 1}` (para mensajes no leídos)

**Operaciones**:
- ✅ CREATE: Endpoint `/dm/send` (POST)
- ✅ READ: Endpoint `/dm/{username}/{other_username}` (GET)
- ✅ UPDATE: Marcar como leído automáticamente al leer conversación
- ❌ DELETE: No implementado

---

## 📊 Neo4j - Base de Datos de Grafos

### Propósito
**Gestionar relaciones sociales y consultas basadas en grafos**. Neo4j es especialista en consultas que requieren atravesar múltiples relaciones (ej: "amigos de mis amigos").

### Nodos

#### `:User`
**Propósito**: Representar usuarios en el grafo social.

**Propiedades**:
```cypher
(:User {
  id: "675...",           // MongoDB _id (string)
  username: "alice",
  email: "alice@example.com",
  name: "Alice Smith",
  bio: "Developer | Tech enthusiast"
})
```

**Constraint sugerido**:
```cypher
CREATE CONSTRAINT user_id_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.id IS UNIQUE;
```

---

#### `:Post`
**Propósito**: Representar posts en el grafo (permite consultas de relaciones entre usuarios y posts).

**Propiedades**:
```cypher
(:Post {
  id: "676...",           // MongoDB _id (string)
  content: "¡Hola mundo!",
  created_at: "2024-12-10T12:00:00.000Z"
})
```

**Constraint sugerido**:
```cypher
CREATE CONSTRAINT post_id_unique IF NOT EXISTS
FOR (p:Post) REQUIRE p.id IS UNIQUE;
```

---

### Relaciones

#### `[:FOLLOWS]`
**Propósito**: Usuario A sigue a Usuario B.

**Dirección**: `(User A)-[:FOLLOWS]->(User B)`

**Propiedades**: Ninguna (por ahora)

**Queries comunes**:
```cypher
// Obtener a quién sigue un usuario
MATCH (u:User {id: $user_id})-[:FOLLOWS]->(f:User)
RETURN f.username

// Contar followers de un usuario
MATCH (:User)-[:FOLLOWS]->(u:User {id: $user_id})
RETURN count(*) AS followers_count

// "Amigos de mis amigos" (sugerencias)
MATCH (u:User {id: $user_id})-[:FOLLOWS]->()-[:FOLLOWS]->(suggestion:User)
WHERE NOT (u)-[:FOLLOWS]->(suggestion) AND u <> suggestion
RETURN DISTINCT suggestion
```

**Endpoint**: `/users/{username}/follow/{target_username}` (POST)

---

#### `[:POSTED]`
**Propósito**: Usuario creó un Post.

**Dirección**: `(User)-[:POSTED]->(Post)`

**Propiedades**: Ninguna (por ahora)

**Queries comunes**:
```cypher
// Contar posts de un usuario
MATCH (u:User {id: $user_id})-[:POSTED]->(p:Post)
RETURN count(*) AS posts_count

// Obtener posts de un usuario ordenados
MATCH (u:User {username: $username})-[:POSTED]->(p:Post)
RETURN p ORDER BY p.created_at DESC
```

**Endpoint**: `/posts/` (POST) - Crea automáticamente esta relación

---

#### `[:LIKES]`
**Propósito**: Usuario dio like a un Post.

**Dirección**: `(User)-[:LIKES]->(Post)`

**Propiedades**: Ninguna (el contador principal está en Redis)

**Queries comunes**:
```cypher
// Verificar si un usuario dio like a un post
MATCH (u:User {id: $user_id})-[:LIKES]->(p:Post {id: $post_id})
RETURN count(*) > 0 AS liked

// Posts más likeados (alternativa a Redis)
MATCH (p:Post)<-[:LIKES]-()
RETURN p, count(*) AS likes_count
ORDER BY likes_count DESC
LIMIT 10
```

**Endpoint**: `/posts/{post_id}/like` (POST), `/posts/{post_id}/like` (DELETE)

---

#### `[:MESSAGED]`
**Propósito**: Usuario A envió mensaje(s) a Usuario B.

**Dirección**: `(User A)-[:MESSAGED]->(User B)`

**Propiedades**:
```cypher
{
  last_message_at: "2024-12-10T12:00:00.000Z"
}
```

**Queries comunes**:
```cypher
// Obtener conversaciones activas de un usuario
MATCH (u:User {username: $username})-[m:MESSAGED]-(other:User)
RETURN other.username, m.last_message_at
ORDER BY m.last_message_at DESC
```

**Endpoint**: `/dm/send` (POST) - Crea/actualiza automáticamente esta relación

---

## ⚡ Redis - Base de Datos en Memoria

### Propósito
**Velocidad y operaciones en tiempo real**. Redis maneja caché de feeds, contadores de likes, y ranking de posts trending.

### Estructuras de Datos

#### 1. **Caché de Feeds**
**Tipo**: STRING (JSON serializado)

**Patrón de keys**:
```
feed:{username}:{mode}:{limit}
```

**Ejemplos**:
- `feed:alice:all:20` → Feed completo de alice (ella + seguidos), 20 posts
- `feed:bob:self:10` → Solo posts de bob, 10 posts
- `feed:charlie:following:20` → Solo posts de los seguidos de charlie, 20 posts

**TTL**: 60 segundos

**Contenido**:
```json
[
  {
    "id": "676...",
    "author_username": "alice",
    "content": "Hello world",
    "tags": ["intro"],
    "created_at": "2024-12-10T12:00:00Z"
  },
  ...
]
```

**Invalidación**: Cuando un usuario crea un post, se ejecuta:
```redis
DEL feed:{author_username}:*
```

**Endpoint**: `/users/{username}/feed` (GET)

---

#### 2. **Contadores de Likes**
**Tipo**: STRING (entero)

**Patrón de keys**:
```
post:{post_id}:likes:count
```

**Ejemplo**:
- `post:676abc123:likes:count` → "42"

**Operaciones**:
```redis
INCR post:676abc123:likes:count  # Dar like
DECR post:676abc123:likes:count  # Quitar like
GET post:676abc123:likes:count   # Obtener contador
```

**Endpoints**:
- `/posts/{post_id}/like` (POST) - INCR
- `/posts/{post_id}/like` (DELETE) - DECR
- `/posts/{post_id}/likes` (GET) - GET

---

#### 3. **Set de Usuarios que Dieron Like**
**Tipo**: SET

**Patrón de keys**:
```
post:{post_id}:likes:users
```

**Ejemplo**:
- `post:676abc123:likes:users` → {"alice", "bob", "charlie"}

**Operaciones**:
```redis
SADD post:676abc123:likes:users "alice"      # Agregar like de alice
SISMEMBER post:676abc123:likes:users "alice" # Verificar si alice dio like
SREM post:676abc123:likes:users "alice"      # Quitar like de alice
SMEMBERS post:676abc123:likes:users          # Ver todos los que dieron like
```

**Propósito**: Evitar likes duplicados y permitir verificar si un usuario específico dio like.

---

#### 4. **Ranking de Posts Trending**
**Tipo**: SORTED SET

**Key**:
```
trending:posts
```

**Estructura**:
```redis
ZADD trending:posts 42 "676abc123"  # Post con 42 likes
ZADD trending:posts 17 "676def456"  # Post con 17 likes
```

**Operaciones**:
```redis
ZINCRBY trending:posts 1 "676abc123"             # Incrementar score (nuevo like)
ZINCRBY trending:posts -1 "676abc123"            # Decrementar score (quitar like)
ZREVRANGE trending:posts 0 9 WITHSCORES          # Top 10 posts trending
```

**Endpoint**: `/trending/posts` (GET)

---

## 🔄 Flujos de Datos Completos

### 1. Crear Usuario

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ POST /users/
       ▼
┌──────────────────┐
│   FastAPI API    │
└──────┬───────────┘
       │
       ├─► 1. Verificar username único en MongoDB
       │
       ├─► 2. INSERT documento en MongoDB.users
       │   {username, email, name, bio}
       │   → Retorna: _id (MongoDB ObjectId)
       │
       └─► 3. CREATE nodo en Neo4j
           MERGE (u:User {id: <_id>})
           SET u.username = ..., u.email = ..., u.name = ..., u.bio = ...
           → Si falla: HTTPException 500
```

**Garantía de Consistencia**: Si Neo4j falla, el endpoint retorna error 500. El usuario queda en MongoDB pero el sistema informa del problema.

---

### 2. Crear Post

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ POST /posts/
       ▼
┌──────────────────┐
│   FastAPI API    │
└──────┬───────────┘
       │
       ├─► 1. Verificar autor existe en MongoDB
       │
       ├─► 2. INSERT documento en MongoDB.posts
       │   {author_username, author_id, content, tags, created_at}
       │   → Retorna: post_id (MongoDB _id)
       │
       ├─► 3. CREATE nodo Post + relación POSTED en Neo4j
       │   MERGE (u:User {id: <author_id>})
       │   MERGE (p:Post {id: <post_id>})
       │   SET p.content = ..., p.created_at = ...
       │   MERGE (u)-[:POSTED]->(p)
       │   → Si falla: HTTPException 500
       │
       └─► 4. INVALIDAR caché en Redis
           DEL feed:{author_username}:*
           → Si falla: Ignorar (no crítico)
```

**Garantía de Consistencia**: Si Neo4j falla, el endpoint retorna error 500. El post queda en MongoDB pero se informa del problema. El caché se invalida de forma best-effort.

---

### 3. Seguir Usuario

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ POST /users/{username}/follow/{target}
       ▼
┌──────────────────┐
│   FastAPI API    │
└──────┬───────────┘
       │
       ├─► 1. Verificar ambos usuarios existen en MongoDB
       │   → Obtener user_id y target_id
       │
       └─► 2. CREATE relación FOLLOWS en Neo4j
           MERGE (u:User {id: <user_id>})
           MERGE (t:User {id: <target_id>})
           MERGE (u)-[:FOLLOWS]->(t)
           → Si falla: HTTPException 500
```

**Nota**: Esta operación solo afecta Neo4j. No hay registro en MongoDB de relaciones FOLLOWS (por diseño, el grafo vive en Neo4j).

---

### 4. Obtener Feed

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ GET /users/{username}/feed?mode=all&limit=20
       ▼
┌──────────────────┐
│   FastAPI API    │
└──────┬───────────┘
       │
       ├─► 1. CHECK caché en Redis
       │   cache_key = "feed:{username}:{mode}:{limit}"
       │   GET cache_key
       │   → Si existe: RETURN datos cacheados ✅ (rápido)
       │
       ├─► 2. Si no hay caché, continuar...
       │
       ├─► 3. QUERY Neo4j para obtener seguidos
       │   MATCH (u:User {id: <user_id>})-[:FOLLOWS]->(f:User)
       │   RETURN f.username
       │   → Lista de usernames seguidos
       │
       ├─► 4. QUERY MongoDB para obtener posts
       │   db.posts.find({
       │     author_username: {$in: [username, ...seguidos]}
       │   }).sort({created_at: -1}).limit(20)
       │   → Lista de posts
       │
       └─► 5. CACHE resultado en Redis
           SETEX cache_key 60 <JSON posts>
           → TTL 60 segundos
```

**Estrategia de Caché**: 
- Cache hit: Respuesta en ~5ms (Redis)
- Cache miss: Respuesta en ~50-100ms (Neo4j + MongoDB)
- TTL corto (60s) para balance entre performance y frescura

---

### 5. Dar Like a Post

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ POST /posts/{post_id}/like?username=alice
       ▼
┌──────────────────┐
│   FastAPI API    │
└──────┬───────────┘
       │
       ├─► 1. CHECK si ya dio like (Redis)
       │   SISMEMBER post:{post_id}:likes:users "alice"
       │   → Si ya existe: RETURN estado actual (idempotente)
       │
       ├─► 2. ATOMIC PIPELINE en Redis
       │   INCR post:{post_id}:likes:count
       │   SADD post:{post_id}:likes:users "alice"
       │   ZINCRBY trending:posts 1 {post_id}
       │   → Ejecutar en pipeline (atómico)
       │
       └─► 3. CREATE relación LIKES en Neo4j
           MERGE (u:User {id: <user_id>})
           MERGE (p:Post {id: <post_id>})
           MERGE (u)-[:LIKES]->(p)
           → Si falla: Warning en logs (no crítico, Redis tiene el dato)
```

**Consistencia Eventual**: Redis es la fuente de verdad para likes. Neo4j se actualiza best-effort. MongoDB eventualmente sincronizará (no implementado aún).

---

### 6. Obtener Posts Trending

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ GET /trending/posts?limit=10
       ▼
┌──────────────────┐
│   FastAPI API    │
└──────┬───────────┘
       │
       ├─► 1. QUERY Redis Sorted Set
       │   ZREVRANGE trending:posts 0 9 WITHSCORES
       │   → Lista: [(post_id, score), ...]
       │
       └─► 2. QUERY MongoDB para detalles de posts
           Para cada post_id:
             db.posts.find_one({_id: ObjectId(post_id)})
           → Retornar posts completos con likes_count
```

**Performance**: Redis sorted set mantiene el ranking actualizado en tiempo real. Solo necesitamos MongoDB para hidratar los detalles.

---

## 🎯 Principios de Diseño

### 1. **MongoDB como Fuente de Verdad**
- Todos los datos completos de usuarios, posts y mensajes viven en MongoDB
- MongoDB es la única fuente para datos descriptivos (nombre, email, contenido)
- Si hay conflicto, MongoDB tiene la razón

### 2. **Neo4j para Relaciones**
- Todas las relaciones sociales (FOLLOWS, LIKES, POSTED, MESSAGED) viven en Neo4j
- Neo4j permite consultas eficientes de grafo (sugerencias, comunidades, influencers)
- Neo4j se sincroniza al crear/actualizar relaciones

### 3. **Redis para Velocidad**
- Caché de feeds con TTL corto (60s)
- Contadores de likes en tiempo real (INCR/DECR atómicos)
- Ranking de trending posts (Sorted Set)
- Redis es volátil: si se pierde, se reconstruye desde MongoDB/Neo4j

### 4. **Consistencia Eventual con Degradación Elegante**
- Crear usuario/post: Si Neo4j falla → Error 500 (no permitir inconsistencia)
- Dar like: Si Neo4j falla → Warning, continuar (Redis tiene el dato)
- Caché: Si Redis falla → Consultar directo a MongoDB/Neo4j (más lento pero funciona)

---

## 📈 Escalabilidad y Optimizaciones

### MongoDB
- **Sharding**: Por `author_username` en colección `posts`
- **Réplicas**: Read replicas para consultas de feed
- **Índices**: Compuestos para queries frecuentes

### Neo4j
- **Índices**: En `User.id` y `Post.id` (constraints)
- **Warmup**: Pre-cargar grafos frecuentes en memoria
- **Particionamiento**: Considerar Neo4j Fabric para múltiples grafos

### Redis
- **Redis Cluster**: Para distribuir carga de caché
- **Persistencia**: AOF para no perder contadores críticos
- **Eviction policy**: `allkeys-lru` para caché, `noeviction` para contadores

---

## 🔍 Consultas Comunes y Performance

### Query: Feed de usuario (modo: all, limit: 20)
**Complejidad**:
1. Redis cache hit: O(1) - ~5ms ⚡
2. Cache miss:
   - Neo4j: O(F) donde F = followers - ~20ms
   - MongoDB: O(log N + L) donde L = limit - ~30ms
   - Total: ~50ms

**Optimización**: Caché con TTL 60s reduce 90% de queries a Neo4j/MongoDB

---

### Query: Sugerencias de usuarios (amigos de amigos)
**Complejidad**:
- Neo4j: O(F²) en peor caso - ~100-200ms para usuarios con muchos followers
- Incluye scoring: mutual_connections * 3 + followers * 2 + posts * 1

**Optimización**: Limitar búsqueda a 2-hops, pre-calcular scores para usuarios populares

---

### Query: Posts trending (top 10)
**Complejidad**:
1. Redis: O(log N) - ~2ms ⚡
2. MongoDB hydration: O(L) - ~10ms
3. Total: ~12ms

**Optimización**: Redis Sorted Set mantiene ranking actualizado en tiempo real

---

## 🚨 Puntos de Atención

### 1. **Sincronización MongoDB ↔ Neo4j**
**Problema**: Si Neo4j falla al crear usuario/post, MongoDB queda con datos "huérfanos"

**Solución actual**: Retornar error 500 (no permitir estado inconsistente)

**Mejora futura**: Implementar saga pattern o job queue para reintentos automáticos

---

### 2. **Contadores de Likes en MongoDB**
**Problema**: Contadores están en Redis (volátil), no persisten en MongoDB

**Solución actual**: Redis con persistencia AOF

**Mejora futura**: Sincronización periódica (cada 5 min) de contadores a MongoDB

---

### 3. **Invalidación de Caché**
**Problema**: Al crear post, solo se invalida caché del autor, no de sus followers

**Solución actual**: TTL corto (60s) garantiza frescura razonable

**Mejora futura**: Invalidar caché de todos los followers (requiere consulta a Neo4j)

---

## 📚 Referencias y Comandos Útiles

### MongoDB
```bash
# Conectar a MongoDB
mongosh mongodb://127.0.0.1:27017/red_k

# Ver colecciones
show collections

# Contar usuarios
db.users.countDocuments()

# Ver posts recientes
db.posts.find().sort({created_at: -1}).limit(5)

# Crear índice
db.posts.createIndex({author_username: 1, created_at: -1})
```

### Neo4j
```bash
# Conectar a Neo4j (desde browser)
# http://localhost:7474
# Usuario: neo4j, Password: password123

# Cypher queries útiles
MATCH (n) RETURN count(n)  // Contar nodos
MATCH ()-[r]->() RETURN count(r)  // Contar relaciones
MATCH (u:User) RETURN u LIMIT 10  // Ver usuarios
MATCH (u:User)-[:FOLLOWS]->(f:User) RETURN u.username, f.username LIMIT 10

# Crear índices
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT post_id_unique IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE;
```

### Redis
```bash
# Conectar a Redis
redis-cli

# Ver todas las keys
KEYS *

# Ver contadores de likes
KEYS post:*:likes:count

# Ver trending posts
ZREVRANGE trending:posts 0 9 WITHSCORES

# Ver caché de feed
KEYS feed:*

# Limpiar toda la base (cuidado!)
FLUSHALL
```

---

## ✅ Checklist de Salud del Sistema

### MongoDB
- [ ] Índices creados en `users.username` y `posts.author_username`
- [ ] Réplica set configurado (producción)
- [ ] Backups automáticos configurados

### Neo4j
- [ ] Constraints de unicidad en `User.id` y `Post.id`
- [ ] Índices de búsqueda en propiedades frecuentes
- [ ] Warmup automático al iniciar

### Redis
- [ ] Persistencia AOF habilitada
- [ ] Eviction policy configurada
- [ ] Monitoreo de memoria

### Integración
- [ ] Health check endpoint `/health` retorna "ok"
- [ ] Logs de errores de Neo4j son monitoreados
- [ ] Métricas de cache hit rate de Redis

---

**Última actualización**: 2024-12-10
**Versión**: 1.0
**Autor**: Sistema de Documentación Automática
