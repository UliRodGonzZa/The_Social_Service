# 🎓 Proyecto Red Social NoSQL - Documentación para Presentación

## 📋 Descripción General

**Red K** es una red social completa que implementa una **arquitectura NoSQL multi-base de datos**, combinando las fortalezas de MongoDB, Redis y Neo4j para diferentes aspectos de la aplicación.

---

## 🗄️ Arquitectura de Bases de Datos

### 1️⃣ MongoDB - Base de Datos de Documentos

**Propósito:** Almacenamiento principal de datos estructurados y semi-estructurados.

**Puerto:** 27017  
**Base de datos:** `red_k`

#### Colecciones y Datos:

##### 📁 Colección `users`
Almacena información de los usuarios.

```javascript
{
  "_id": ObjectId("..."),
  "username": "rodrigo",
  "email": "rodrigo@example.com",
  "name": "Rodrigo",
  "bio": "Desarrollador Full Stack",
  "following": ["kam", "alice"],      // Fallback de Neo4j
  "followers": ["bob", "carol"]       // Fallback de Neo4j
}
```

**Operaciones principales:**
- `find()` - Buscar usuarios
- `insert_one()` - Crear usuario
- `update_one()` - Actualizar perfil

##### 📁 Colección `posts`
Almacena las publicaciones de los usuarios.

```javascript
{
  "_id": ObjectId("..."),
  "author_username": "rodrigo",
  "author_id": "user_id_123",
  "content": "Mi primer post en Red K!",
  "tags": ["nosql", "proyecto"],
  "created_at": "2025-12-12T10:30:00",
  "likes": ["kam", "alice"]          // Fallback de Redis
}
```

**Operaciones principales:**
- `find()` - Listar posts
- `insert_one()` - Crear post
- `sort()` - Ordenar por fecha

##### 📁 Colección `dms` (Direct Messages)
Almacena mensajes directos entre usuarios.

```javascript
{
  "_id": ObjectId("..."),
  "sender_username": "rodrigo",
  "receiver_username": "kam",
  "content": "Hola! Cómo estás?",
  "created_at": "2025-12-12T15:45:00",
  "read": false,
  "read_at": null,
  "conversation_key": "kam::rodrigo"  // Clave ordenada alfabéticamente
}
```

**Índices importantes:**
```javascript
// Índice en conversation_key para búsquedas rápidas
db.dms.createIndex({ "conversation_key": 1 })

// Índice compuesto para mensajes no leídos
db.dms.createIndex({ "receiver_username": 1, "read": 1 })
```

**¿Por qué MongoDB?**
- ✅ Flexible schema para posts con diferentes tipos de contenido
- ✅ Consultas complejas (filtros, agregaciones)
- ✅ Escalabilidad horizontal con sharding
- ✅ Perfecto para datos con estructura variable

---

### 2️⃣ Redis - Base de Datos en Memoria (Cache & Real-time)

**Propósito:** Caché de alto rendimiento, contadores en tiempo real, trending.

**Puerto:** 6379  
**Tipo:** Key-Value Store en memoria

#### Estructuras de Datos Utilizadas:

##### 🔢 Contadores de Likes (String)
```
Key: "post:{post_id}:likes:count"
Value: "25"
Tipo: String (counter)

Comandos:
INCR post:abc123:likes:count    → Incrementa likes
GET post:abc123:likes:count     → Obtiene total
DECR post:abc123:likes:count    → Decrementa likes
```

##### 👥 Set de Usuarios que dieron Like (Set)
```
Key: "post:{post_id}:likes:users"
Value: {"rodrigo", "kam", "alice"}
Tipo: Set

Comandos:
SADD post:abc123:likes:users "rodrigo"     → Agrega like
SREM post:abc123:likes:users "rodrigo"     → Quita like
SISMEMBER post:abc123:likes:users "rodrigo" → Verifica si dio like
SCARD post:abc123:likes:users              → Cuenta total
```

##### 📈 Trending Posts (Sorted Set)
```
Key: "trending:posts"
Value: {post_id: score}
Tipo: Sorted Set (ZSET)

Estructura:
"trending:posts" → {
  "post_abc123": 45,    // 45 likes
  "post_def456": 32,
  "post_ghi789": 18
}

Comandos:
ZINCRBY trending:posts 1 "post_abc123"          → Incrementa score
ZREVRANGE trending:posts 0 9 WITHSCORES         → Top 10 posts
ZRANK trending:posts "post_abc123"              → Posición en ranking
```

##### 💾 Caché de Feeds (Hash/String con TTL)
```
Key: "feed:{username}:{mode}:{limit}"
Value: JSON serializado con posts
TTL: 60 segundos

Comandos:
SETEX feed:rodrigo:all:20 60 "[{...posts...}]"  → Cachea con expiración
GET feed:rodrigo:all:20                          → Obtiene del cache
DEL feed:rodrigo:*                               → Invalida cache
```

**¿Por qué Redis?**
- ⚡ Latencia ultra-baja (<1ms)
- ✅ Perfecto para likes en tiempo real
- ✅ Trending posts con Sorted Sets
- ✅ Caché para reducir carga en MongoDB
- ✅ Expiración automática de datos (TTL)

---

### 3️⃣ Neo4j - Base de Datos de Grafos

**Propósito:** Relaciones sociales (follows, sugerencias de amigos).

**Puerto HTTP:** 7474  
**Puerto Bolt:** 7687  
**Usuario:** neo4j  
**Password:** password123

#### Modelo de Datos:

##### 👤 Nodos: User
```cypher
(:User {
  id: "user_mongo_id",
  username: "rodrigo",
  email: "rodrigo@example.com",
  name: "Rodrigo",
  bio: "Developer"
})
```

##### 📝 Nodos: Post
```cypher
(:Post {
  id: "post_mongo_id",
  content: "Mi post...",
  created_at: "2025-12-12T10:30:00"
})
```

##### 🔗 Relaciones:

**FOLLOWS** - Un usuario sigue a otro
```cypher
(rodrigo:User)-[:FOLLOWS]->(kam:User)
```

**POSTED** - Un usuario crea un post
```cypher
(rodrigo:User)-[:POSTED]->(post:Post)
```

**LIKES** - Un usuario le da like a un post
```cypher
(rodrigo:User)-[:LIKES]->(post:Post)
```

**MESSAGED** - Comunicación entre usuarios (DMs)
```cypher
(rodrigo:User)-[:MESSAGED {last_message_at: "2025-12-12"}]->(kam:User)
```

#### Consultas Principales:

##### 1. Obtener Usuarios que Sigo
```cypher
MATCH (u:User {id: $user_id})-[:FOLLOWS]->(followed:User)
RETURN followed.username, followed.name, followed.bio
```

##### 2. Sugerencias de Amigos (Amigos de Amigos)
```cypher
// Usuarios a 2 saltos que aún no sigo
MATCH (u:User {id: $user_id})-[:FOLLOWS]->(:User)-[:FOLLOWS]->(suggested:User)
WHERE suggested.id <> $user_id
  AND NOT (u)-[:FOLLOWS]->(suggested)
WITH u, suggested, COUNT(*) AS mutual_connections

// Contar followers del sugerido
OPTIONAL MATCH (suggested)<-[:FOLLOWS]-(:User)
WITH suggested, mutual_connections, COUNT(*) AS followers_count

// Contar posts del sugerido
OPTIONAL MATCH (suggested)-[:POSTED]->(:Post)
WITH suggested, mutual_connections, followers_count, COUNT(*) AS posts_count

// Calcular score compuesto
RETURN
  suggested.username,
  mutual_connections,
  followers_count,
  posts_count,
  (mutual_connections * 3.0 + followers_count * 2.0 + posts_count * 1.0) AS score
ORDER BY score DESC
LIMIT 10
```

##### 3. Feed Personalizado
```cypher
// Posts míos + de quienes sigo
MATCH (u:User {id: $user_id})
MATCH (author:User)-[:POSTED]->(post:Post)
WHERE author.id = $user_id OR (u)-[:FOLLOWS]->(author)
RETURN post.id, post.content, post.created_at, author.username
ORDER BY post.created_at DESC
LIMIT 20
```

**¿Por qué Neo4j?**
- 🕸️ Relaciones sociales son naturalmente un grafo
- ✅ Consultas de "amigos de amigos" son simples
- ✅ Algoritmos de sugerencias eficientes
- ✅ Visualización de la red social
- ✅ Traversals complejos en tiempo constante

---

## 🔄 Integración entre Bases de Datos

### Flujo: Crear un Post

```
1. Usuario crea post en frontend
   ↓
2. Backend: INSERT en MongoDB (posts collection)
   ↓
3. Backend: CREATE nodo en Neo4j + relación POSTED
   ↓
4. Backend: Invalidar caché del feed en Redis
   ↓
5. Frontend: Muestra el post
```

### Flujo: Dar Like a un Post

```
1. Usuario da like en frontend
   ↓
2. Backend: Redis
   - INCR post:{id}:likes:count
   - SADD post:{id}:likes:users {username}
   - ZINCRBY trending:posts 1 {post_id}
   ↓
3. Backend: Neo4j
   - CREATE relación (User)-[:LIKES]->(Post)
   ↓
4. Frontend: Actualiza contador en tiempo real
```

### Flujo: Seguir a un Usuario

```
1. Usuario hace click en "Seguir"
   ↓
2. Backend: Neo4j
   - MATCH usuarios
   - CREATE relación (User)-[:FOLLOWS]->(User)
   ↓
3. Backend: Redis
   - DEL feed:{username}:*  (invalida caché)
   ↓
4. Frontend: Actualiza botón a "Siguiendo"
```

### Flujo: Ver Feed Personalizado

```
1. Usuario abre /feed
   ↓
2. Backend: Intenta leer de Redis cache
   - GET feed:{username}:all:20
   ↓
3. Si NO existe en cache:
   a. Consulta Neo4j: ¿A quién sigo?
   b. Consulta MongoDB: Posts de esos usuarios
   c. Guarda en Redis con TTL 60s
   ↓
4. Frontend: Renderiza posts
```

---

## 🎨 Frontend - Tecnologías

### Stack Frontend:

- **React 18** - Librería UI
- **Redux Toolkit** - State management global
- **React Router 6** - Navegación SPA
- **Tailwind CSS** - Estilos utility-first
- **Axios** - HTTP client
- **React Icons** - Iconografía
- **Lucide React** - Iconos modernos

### Estructura:

```
frontend/
├── src/
│   ├── app/
│   │   └── store.js              # Redux store global
│   ├── features/
│   │   ├── auth/                 # Autenticación
│   │   │   └── authSlice.js
│   │   ├── posts/                # Posts
│   │   │   └── postsSlice.js
│   │   ├── users/                # Usuarios
│   │   │   └── usersSlice.js
│   │   └── messages/             # Mensajes
│   │       └── ConversationList.jsx
│   ├── pages/
│   │   ├── AuthPage.jsx          # Login/Registro
│   │   ├── FeedPage.jsx          # Feed principal
│   │   ├── TrendingPage.jsx      # Posts trending
│   │   ├── DiscoverPage.jsx      # Descubrir usuarios
│   │   ├── ProfilePage.jsx       # Perfil de usuario
│   │   ├── MessagesPage.jsx      # Mensajes directos
│   │   └── AdminPage.jsx         # Panel admin
│   ├── components/
│   │   ├── Navbar.jsx            # Navegación
│   │   ├── Layout.jsx            # Layout general
│   │   └── PostCard.jsx          # Tarjeta de post
│   └── App.js                    # Configuración rutas
```

### Configuración de Estado con Redux:

```javascript
// store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import postsReducer from '../features/posts/postsSlice';
import usersReducer from '../features/users/usersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,      // Estado de autenticación
    posts: postsReducer,    // Lista de posts, likes
    users: usersReducer,    // Usuarios, sugerencias
  },
});
```

### Comunicación con Backend:

```javascript
// Ejemplo: Crear post
const createPost = async (content) => {
  const response = await fetch(
    `${process.env.REACT_APP_BACKEND_URL}/api/posts/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_username: username,
        content: content,
        tags: []
      })
    }
  );
  return response.json();
};
```

---

## 🐍 Backend - Tecnologías

### Stack Backend:

- **FastAPI** - Framework web moderno (Python 3.10+)
- **Uvicorn** - ASGI server
- **Pydantic** - Validación de datos
- **PyMongo** - Driver MongoDB
- **Redis-py** - Cliente Redis
- **Neo4j Python Driver** - Cliente Neo4j
- **Python-dotenv** - Gestión de variables de entorno

### Arquitectura del Backend:

```
backend/
├── app/
│   ├── main.py              # Endpoints principales (370 líneas)
│   ├── mongo.py             # Conexión centralizada MongoDB
│   ├── observability.py     # Dashboard de observabilidad
│   └── redis_cluster.py     # Utilidades Redis Cluster
├── server.py                # Entry point, monta apps
├── requirements.txt         # Dependencias Python
└── .env                     # Variables de entorno
```

### Variables de Entorno:

```bash
# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/red_k
DB_NAME=red_k

# Redis
REDIS_URL=redis://127.0.0.1:6379/0

# Neo4j
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
```

### Endpoints Principales:

#### Usuarios
```
POST   /api/users/                    # Crear usuario
GET    /api/users/                    # Listar usuarios
GET    /api/users/by-username/{user}  # Obtener por username
POST   /api/users/{user}/follow/{target}  # Seguir usuario
DELETE /api/users/{user}/follow/{target}  # Dejar de seguir
GET    /api/users/{user}/following    # Ver a quién sigo
GET    /api/users/{user}/suggestions  # Sugerencias de amigos
```

#### Posts
```
POST   /api/posts/                    # Crear post
GET    /api/users/{user}/feed?mode=all  # Ver feed
GET    /api/trending/posts            # Posts trending
POST   /api/posts/{id}/like           # Dar like
DELETE /api/posts/{id}/like           # Quitar like
GET    /api/posts/{id}/likes          # Info de likes
```

#### Mensajes Directos
```
POST   /api/dm/send                              # Enviar mensaje
GET    /api/dm/{user}/{other}?mark_read=true    # Ver conversación
GET    /api/dm/conversations/{user}             # Listar conversaciones
```

#### Admin
```
GET    /api/admin/stats/summary           # Resumen general
GET    /api/admin/stats/users/top-posters # Top usuarios
GET    /api/admin/stats/posts/by-day      # Posts por día
GET    /api/admin/stats/dms/summary       # Stats de mensajes
GET    /api/admin/stats/users/{username}  # Stats de usuario
```

---

## 🚀 Comandos para Levantar el Proyecto

### Opción 1: Con Docker Compose (Recomendado)

```bash
# Levantar todas las bases de datos
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

**¿Qué hace `docker-compose up`?**
1. Descarga imágenes de Docker (mongo:7, neo4j:5, redis:7)
2. Crea red virtual `redk_network`
3. Levanta contenedores:
   - MongoDB en puerto 27017
   - Neo4j en puertos 7474 (HTTP), 7687 (Bolt)
   - Redis en puerto 6379
4. Crea volúmenes persistentes para los datos

### Opción 2: Manual (Desarrollo Local)

#### Backend:

```bash
# 1. Crear entorno virtual
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar .env
cp .env.example .env
# Editar .env con tus credenciales

# 4. Levantar servidor
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

**¿Qué es Uvicorn?**
- Servidor ASGI de alto rendimiento
- `--reload`: Recarga automática al cambiar código
- `--host 0.0.0.0`: Acepta conexiones de cualquier IP
- `--port 8001`: Puerto del servidor

#### Frontend:

```bash
# 1. Instalar dependencias
cd frontend
yarn install
# o: npm install

# 2. Configurar .env
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# 3. Levantar servidor de desarrollo
yarn start
# o: npm start
```

**¿Qué es Yarn?**
- Gestor de paquetes de JavaScript (alternativa a npm)
- `yarn install`: Instala todas las dependencias de package.json
- `yarn start`: Inicia servidor de desarrollo en puerto 3000
- Hot reload automático al editar archivos

---

## 📊 Flujo Completo de la Aplicación

### 1. Inicialización

```
┌─────────────────────────────────────────────────┐
│  docker-compose up -d                           │
├─────────────────────────────────────────────────┤
│  ✓ MongoDB iniciado (puerto 27017)             │
│  ✓ Redis iniciado (puerto 6379)                │
│  ✓ Neo4j iniciado (puertos 7474, 7687)         │
└─────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────┐
│  uvicorn server:app --reload --port 8001        │
├─────────────────────────────────────────────────┤
│  ✓ FastAPI app iniciada                        │
│  ✓ Conectado a MongoDB                         │
│  ✓ Conectado a Redis                           │
│  ✓ Conectado a Neo4j                           │
│  ✓ Endpoints registrados                       │
│  Servidor escuchando en: http://0.0.0.0:8001   │
└─────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────┐
│  yarn start (frontend)                          │
├─────────────────────────────────────────────────┤
│  ✓ React app compilada                         │
│  ✓ Redux store configurado                     │
│  ✓ Rutas registradas                           │
│  Aplicación disponible en: http://localhost:3000│
└─────────────────────────────────────────────────┘
```

### 2. Usuario Crea Cuenta

```
Frontend                Backend              MongoDB        Neo4j
   |                       |                    |            |
   |-- POST /api/users/ -->|                    |            |
   |                       |-- insert_one() --->|            |
   |                       |                    |<- OK ------| 
   |                       |-- CREATE (:User) ------------>  |
   |                       |                    |         <--OK
   |<------ UserOut -------|                    |            |
   |                       |                    |            |
```

### 3. Usuario Sigue a Otro

```
Frontend                Backend              MongoDB        Neo4j        Redis
   |                       |                    |            |            |
   |-- POST /follow ------>|                    |            |            |
   |                       |-- find_one() ----->|            |            |
   |                       |                 <--OK           |            |
   |                       |-- CREATE [:FOLLOWS] ----------->|            |
   |                       |                    |         <--OK           |
   |                       |-- DEL feed:* ---------------------------->   |
   |                       |                    |            |         <--OK
   |<------ Success -------|                    |            |            |
```

### 4. Usuario Ve su Feed

```
Frontend             Backend        Redis          Neo4j        MongoDB
   |                    |             |              |              |
   |-- GET /feed ------>|             |              |              |
   |                    |-- GET cache ->              |              |
   |                    |          <--MISS            |              |
   |                    |-- MATCH [:FOLLOWS] -------->|              |
   |                    |                          <--[users]        |
   |                    |-- find({author: $in}) ------------------->|
   |                    |                             |           <--[posts]
   |                    |-- SETEX cache(60s) -------->|              |
   |<---- [posts] ------|             |              |              |
```

---

## 💡 Patrones de Diseño NoSQL Implementados

### 1. Patrón de Fallback/Resiliencia

Si Redis o Neo4j fallan, la app sigue funcionando usando MongoDB:

```python
# Intentar Neo4j para obtener follows
try:
    driver = get_neo4j_driver()
    # Consulta Neo4j...
except:
    # Fallback a MongoDB
    user_doc = users_col.find_one({"username": username})
    following = user_doc.get("following", [])
```

### 2. Patrón de Cache-Aside

```python
# 1. Intentar leer del cache
cached = redis.get(cache_key)
if cached:
    return json.loads(cached)

# 2. Si no existe, consultar DB
posts = mongo.find({...})

# 3. Guardar en cache
redis.setex(cache_key, 60, json.dumps(posts))
return posts
```

### 3. Patrón Polyglot Persistence

Cada base de datos hace lo que mejor sabe:
- **MongoDB**: Almacenamiento persistente, queries complejos
- **Redis**: Contadores, cache, tiempo real
- **Neo4j**: Relaciones, grafos, sugerencias

### 4. Patrón Event-Driven

```python
# Acción: Usuario da like
def like_post(post_id, username):
    # 1. Actualizar contador en Redis (tiempo real)
    redis.incr(f"post:{post_id}:likes:count")
    redis.sadd(f"post:{post_id}:likes:users", username)
    
    # 2. Actualizar grafo en Neo4j (relaciones)
    neo4j.run("CREATE (u:User)-[:LIKES]->(p:Post)")
    
    # 3. Agregar a trending (analytics)
    redis.zincrby("trending:posts", 1, post_id)
```

---

## 📈 Métricas y Estadísticas

### Panel de Administrador (`/admin`)

Implementa métricas calculadas en tiempo real desde MongoDB:

**Resumen General:**
- Total de usuarios registrados
- Total de posts creados
- Total de mensajes directos
- Usuarios activos (últimos 7 días)
- Posts creados (últimos 7 días)
- Engagement rate

**Top Usuarios:**
```javascript
// Agregación en MongoDB
db.posts.aggregate([
  { $group: { _id: "$author_username", posts_count: { $sum: 1 } } },
  { $sort: { posts_count: -1 } },
  { $limit: 10 }
])
```

**Posts por Día:**
```javascript
// Filtro por fecha
db.posts.find({ 
  created_at: { $gte: "2025-12-09T00:00:00" } 
})
// Agrupación manual en Python por fecha
```

---

## 🎯 Ventajas de esta Arquitectura Multi-Base de Datos

1. **Rendimiento Optimizado**
   - Redis para operaciones en tiempo real (<1ms)
   - MongoDB para almacenamiento persistente
   - Neo4j para consultas de grafos complejas

2. **Escalabilidad**
   - MongoDB: Sharding horizontal
   - Redis: Particionamiento por clave
   - Neo4j: Clustering (Enterprise)

3. **Resiliencia**
   - Fallbacks entre bases de datos
   - Cache para reducir carga
   - Tolerancia a fallos

4. **Especialización**
   - Cada DB hace lo que mejor sabe
   - No hay "one size fits all"
   - Polyglot Persistence

---

## 🔧 Troubleshooting

### MongoDB no conecta
```bash
# Verificar que esté corriendo
docker ps | grep mongo

# Reiniciar
docker-compose restart mongo

# Ver logs
docker-compose logs mongo
```

### Neo4j no conecta
```bash
# Verificar credenciales
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Abrir browser
http://localhost:7474

# Test desde código
from neo4j import GraphDatabase
driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password123"))
driver.verify_connectivity()
```

### Redis no conecta
```bash
# Verificar
redis-cli ping
# Debe responder: PONG

# Test desde Python
import redis
r = redis.from_url("redis://localhost:6379/0")
r.ping()  # True
```

---

## 📚 Conclusión para Presentación

Este proyecto demuestra:

✅ **Conocimiento profundo de NoSQL:**
- 3 tipos de bases de datos diferentes
- Uso correcto de cada una según sus fortalezas
- Patrones de diseño NoSQL

✅ **Arquitectura completa:**
- Backend con FastAPI
- Frontend con React + Redux
- Integración multi-base de datos

✅ **Características reales de producción:**
- Cache con TTL
- Métricas en tiempo real
- Sugerencias inteligentes
- Panel de administración

✅ **Escalabilidad y Resiliencia:**
- Fallbacks entre DBs
- Cache para reducir latencia
- Arquitectura desacoplada

---

## 📖 Referencias

- MongoDB: https://docs.mongodb.com/
- Redis: https://redis.io/docs/
- Neo4j: https://neo4j.com/docs/
- FastAPI: https://fastapi.tiangolo.com/
- React: https://react.dev/

---

**¡Éxito en tu presentación! 🚀**
