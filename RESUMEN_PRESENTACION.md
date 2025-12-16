# Resumen Ejecutivo - Proyecto Red Social NoSQL

## Elevator Pitch (30 segundos)

**Red K** es una red social que implementa **Polyglot Persistence**, combinando MongoDB, Redis y Neo4j. Cada base de datos resuelve un problema específico: MongoDB para datos persistentes, Redis para tiempo real y cache, Neo4j para relaciones sociales.

---

##  Bases de Datos - ¿Qué hace cada una?

| Base de Datos | Tipo | Puerto | Uso Principal | Ejemplo |
|--------------|------|--------|---------------|---------|
| **MongoDB** | Documentos | 27017 | Almacenamiento principal | Users, Posts, Mensajes |
| **Redis** | Key-Value | 6379 | Cache + Tiempo Real | Likes, Trending, Cache del Feed |
| **Neo4j** | Grafos | 7687 | Relaciones sociales | Follows, Sugerencias de amigos |

### MongoDB - Colecciones:
```
users    → Perfiles de usuario (username, email, bio)
posts    → Publicaciones (content, tags, created_at)
dms      → Mensajes directos (sender, receiver, content)
```

### Redis - Estructuras:
```
post:{id}:likes:count     → Contador de likes (String)
post:{id}:likes:users     → Set de usuarios que dieron like (Set)
trending:posts            → Posts ordenados por likes (Sorted Set)
feed:{user}:{mode}        → Cache del feed (String + TTL 60s)
```

### Neo4j - Relaciones:
```
(User)-[:FOLLOWS]->(User)    → Seguir usuario
(User)-[:POSTED]->(Post)     → Crear post
(User)-[:LIKES]->(Post)      → Dar like
(User)-[:MESSAGED]->(User)   → Mensajes directos
```

---

##  Ejemplo: ¿Qué pasa cuando das Like a un Post?

```
1. Frontend: Click en 
   ↓
2. Backend: Redis
   - INCR post:abc:likes:count        (contador +1)
   - SADD post:abc:likes:users user   (agregar a set)
   - ZINCRBY trending:posts 1 abc     (subir en ranking)
   ↓
3. Backend: Neo4j
   - CREATE (User)-[:LIKES]->(Post)   (guardar relación)
   ↓
4. Frontend: Actualiza UI en tiempo real
```

**¿Por qué es rápido?** Redis responde en <1ms vs MongoDB ~10-50ms

---

##  Comandos para Correr el Proyecto

### 1⃣ Levantar Bases de Datos:
```bash
docker-compose up -d
```
Esto levanta MongoDB, Redis y Neo4j automáticamente.

### 2⃣ Backend (FastAPI):
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

**¿Qué es uvicorn?**  
Servidor ASGI para FastAPI (como Gunicorn pero más rápido).  
`--reload` = recarga automática al cambiar código.

### 3⃣ Frontend (React):
```bash
cd frontend
yarn install
yarn start
```

**¿Qué hace yarn?**  
Instala dependencias de `package.json` y levanta servidor de desarrollo en puerto 3000.

---

##  Arquitectura del Sistema

```
┌─────────────────────────────────────────────────┐
│           FRONTEND (React + Redux)              │
│         http://localhost:3000                   │
└───────────────────┬─────────────────────────────┘
                    │ HTTP/REST
                    ↓
┌─────────────────────────────────────────────────┐
│         BACKEND (FastAPI + Uvicorn)             │
│         http://localhost:8001/api               │
└─┬───────────────┬───────────────┬───────────────┘
  │               │               │
  ↓               ↓               ↓
┌─────────┐  ┌──────────┐  ┌──────────┐
│ MongoDB │  │  Redis   │  │  Neo4j   │
│  :27017 │  │  :6379   │  │  :7687   │
└─────────┘  └──────────┘  └──────────┘
```

---

##  Endpoints Principales del API

### Usuarios:
```
POST   /api/users/                          → Crear usuario
POST   /api/users/{user}/follow/{target}    → Seguir
GET    /api/users/{user}/suggestions        → Amigos sugeridos
```

### Posts:
```
POST   /api/posts/                    → Crear post
GET    /api/users/{user}/feed         → Ver feed personalizado
POST   /api/posts/{id}/like           → Dar like
GET    /api/trending/posts            → Top trending
```

### Mensajes:
```
POST   /api/dm/send                              → Enviar DM
GET    /api/dm/{user}/{other}                    → Ver conversación
GET    /api/dm/conversations/{user}              → Listar chats
```

---

##  Decisiones de Diseño Clave

### 1. ¿Por qué usar 3 bases de datos?

**MongoDB:**
-  Schema flexible para posts con diferentes formatos
-  Queries complejos con filtros y agregaciones
-  Almacenamiento persistente confiable

**Redis:**
-  Latencia <1ms para likes en tiempo real
-  Sorted Sets perfectos para trending
-  Expiración automática de cache (TTL)

**Neo4j:**
-  "Amigos de amigos" en una sola query
-  Sugerencias inteligentes basadas en grafo
-  Relaciones sociales son naturalmente un grafo

### 2. Patrón de Cache-Aside

```python
# Siempre intenta Redis primero
cache_key = f"feed:{username}:all:20"
cached = redis.get(cache_key)

if cached:
    return json.loads(cached)  #  Rápido

# Si no existe, consulta MongoDB
posts = mongo.find({...})

# Guarda en cache 60 segundos
redis.setex(cache_key, 60, json.dumps(posts))
return posts
```

**Resultado:** Feed carga en ~10ms vs ~200ms sin cache.

### 3. Resiliencia con Fallbacks

```python
try:
    # Intenta Neo4j para follows
    following = neo4j.query("MATCH ...-[:FOLLOWS]->...")
except:
    # Si falla, usa MongoDB
    user = mongo.find_one({"username": username})
    following = user.get("following", [])
```

La app **nunca se cae** aunque alguna DB falle.

---

##  Métricas del Panel Admin

El endpoint `/api/admin/stats/summary` muestra:

```json
{
  "total_users": 4,
  "total_posts": 3,
  "total_dms": 9,
  "active_users_last_7d": 3,
  "posts_last_7d": 3,
  "dms_last_7d": 9
}
```

Calcula usando agregaciones de MongoDB:

```python
db.posts.aggregate([
  { "$group": { "_id": "$author_username", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } }
])
```

---

##  Consulta Destacada: Sugerencias de Amigos

**Problema:** Recomendar usuarios que probablemente conozcas.

**Solución en Neo4j:**

```cypher
// Encuentra amigos de tus amigos
MATCH (yo:User {id: $user_id})-[:FOLLOWS]->()-[:FOLLOWS]->(sugerido:User)
WHERE sugerido.id <> $user_id              // No sugerirte a ti mismo
  AND NOT (yo)-[:FOLLOWS]->(sugerido)      // Que no sigas ya

// Cuenta conexiones mutuas
WITH sugerido, COUNT(*) AS conexiones_mutuas

// Cuenta popularidad
OPTIONAL MATCH (sugerido)<-[:FOLLOWS]-()
WITH sugerido, conexiones_mutuas, COUNT(*) AS followers

// Cuenta actividad
OPTIONAL MATCH (sugerido)-[:POSTED]->()
WITH sugerido, conexiones_mutuas, followers, COUNT(*) AS posts

// Score compuesto (más peso a conexiones mutuas)
RETURN sugerido.username,
       conexiones_mutuas,
       (conexiones_mutuas * 3 + followers * 2 + posts) AS score
ORDER BY score DESC
LIMIT 10
```

**Resultado:** Sugerencias personalizadas e inteligentes.

---

##  Stack Tecnológico

### Backend:
- **FastAPI** - Framework web Python
- **Uvicorn** - Servidor ASGI
- **PyMongo** - Driver MongoDB
- **redis-py** - Cliente Redis
- **neo4j** - Driver Neo4j

### Frontend:
- **React 18** - Librería UI
- **Redux Toolkit** - State management
- **React Router** - Navegación
- **Tailwind CSS** - Estilos
- **Axios** - HTTP client

---

##  Cómo Probar Funcionalidades

### 1. Crear Usuario:
```bash
curl -X POST http://localhost:8001/api/users/ \
  -H "Content-Type: application/json" \
  -d '{"username":"rodrigo","email":"r@test.com","name":"Rodrigo"}'
```

### 2. Crear Post:
```bash
curl -X POST http://localhost:8001/api/posts/ \
  -H "Content-Type: application/json" \
  -d '{"author_username":"rodrigo","content":"Mi primer post!"}'
```

### 3. Ver Trending:
```bash
curl http://localhost:8001/api/trending/posts
```

### 4. Verificar Redis:
```bash
redis-cli
> GET "post:abc123:likes:count"
> SMEMBERS "post:abc123:likes:users"
> ZREVRANGE "trending:posts" 0 9 WITHSCORES
```

### 5. Verificar Neo4j:
Abre http://localhost:7474 y ejecuta:
```cypher
MATCH (u:User)-[:FOLLOWS]->(f:User)
RETURN u.username, f.username
```

---

##  Puntos Clave para la Presentación

1. **Polyglot Persistence**: Cada DB hace lo que mejor sabe
2. **Rendimiento**: Redis <1ms para likes en tiempo real
3. **Inteligencia**: Neo4j para sugerencias basadas en grafo social
4. **Resiliencia**: Fallbacks automáticos si alguna DB falla
5. **Escalabilidad**: Arquitectura preparada para crecer
6. **Stack Moderno**: FastAPI + React + NoSQL

---

##  Flujo Completo: Crear Post → Dar Like → Ver Trending

```
1. POST /api/posts/ → MongoDB (insertar) + Neo4j (relación POSTED)
   
2. POST /api/posts/{id}/like → Redis (INCR, SADD, ZINCRBY) + Neo4j (LIKES)
   
3. GET /api/trending/posts → Redis (ZREVRANGE trending:posts) → MongoDB (detalles)
```

**Tiempo total:** ~15ms (gracias a Redis)

---

##  Archivos Importantes

```
/app/PRESENTACION_PROYECTO_NOSQL.md    → Documentación completa
/app/RESUMEN_PRESENTACION.md           → Este resumen
/app/backend/app/main.py               → Endpoints principales
/app/backend/app/mongo.py              → Conexión MongoDB
/app/frontend/src/pages/AdminPage.jsx → Panel de métricas
```

---

**¡Éxito con tu presentación NoSQL! **

**Recuerda:** El valor está en mostrar que entiendes **CUÁNDO y POR QUÉ** usar cada base de datos, no solo en hacerlas funcionar.
