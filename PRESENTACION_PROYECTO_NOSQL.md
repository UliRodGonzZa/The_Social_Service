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

##### Colección `users`
Almacena información de los usuarios.

**Ubicación de creación:** `/app/backend/app/main.py` - Líneas 235-280 (endpoint POST /users/)

**Esquema del documento:**
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

**Decisión de diseño:**
Se eligió MongoDB para usuarios porque permite un esquema flexible. Los campos following y followers se agregaron como fallback redundante: si Neo4j no está disponible, la aplicación puede seguir funcionando consultando estos arrays en MongoDB. Esto implementa el patrón de resiliencia.

**Operaciones principales:**
- `users_col.find()` - Buscar usuarios (línea 289)
- `users_col.insert_one()` - Crear usuario (línea 269)
- `users_col.find_one()` - Buscar por username (línea 306)

**Texto para presentación:**
"La colección users se crea automáticamente en MongoDB cuando insertamos el primer usuario. Elegimos MongoDB por su capacidad de manejar documentos con esquemas variables. Por ejemplo, algunos usuarios pueden tener bio y otros no, sin necesidad de definir un esquema rígido. Las operaciones de lectura usan find() y find_one(), que son consultas O(1) cuando usamos índices en username."

##### Colección `posts`
Almacena las publicaciones de los usuarios.

**Ubicación de creación:** `/app/backend/app/main.py` - Líneas 484-563 (endpoint POST /posts/)

**Esquema del documento:**
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

**Decisión de diseño:**
MongoDB es ideal para posts porque permite almacenar contenido de longitud variable, arrays de tags sin límite predefinido, y timestamps en formato ISO. El campo likes como array sirve como fallback si Redis no está disponible. La consulta principal usa sort en created_at para ordenar cronológicamente.

**Operaciones principales:**
- `posts_col.find()` - Listar posts (línea 609)
- `posts_col.insert_one()` - Crear post (línea 529)
- `posts_col.find().sort("created_at", -1)` - Ordenar por fecha descendente (línea 610)

**Texto para presentación:**
"Los posts se almacenan en MongoDB porque necesitamos persistencia y la capacidad de hacer consultas complejas. Por ejemplo, el feed personalizado requiere filtrar posts por múltiples autores usando el operador $in, lo cual MongoDB maneja eficientemente. El sort por created_at nos da orden cronológico inverso, mostrando los posts más recientes primero."

##### Colección `dms` (Direct Messages)
Almacena mensajes directos entre usuarios.

**Ubicación de creación:** `/app/backend/app/main.py` - Líneas 725-786 (endpoint POST /dm/send)

**Esquema del documento:**
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

**Decisión de diseño:**
El campo conversation_key es crítico: normaliza la conversación entre dos usuarios ordenando sus usernames alfabéticamente. Esto permite que "rodrigo::kam" y "kam::rodrigo" se traten como la misma conversación. Sin este campo, necesitaríamos consultas con OR doble, que son menos eficientes.

**Índices recomendados:**
```javascript
// Índice en conversation_key para búsquedas O(log n)
db.dms.createIndex({ "conversation_key": 1 })

// Índice compuesto para mensajes no leídos
db.dms.createIndex({ "receiver_username": 1, "read": 1 })
```

**Implementación:** `/app/backend/app/main.py` - Líneas 745-747
```python
u1, u2 = sorted([dm.sender_username, dm.receiver_username])
conversation_key = f"{u1}::{u2}"
```

**Texto para presentación:**
"Los mensajes directos están en MongoDB porque necesitamos ordenación cronológica y consultas por conversation_key. Este patrón de normalización es importante: en lugar de hacer una consulta con OR para encontrar mensajes donde 'yo soy sender O receiver', creamos una clave única por conversación. Esto reduce la complejidad de O(n) a O(log n) con un índice apropiado."

---

### 2️⃣ Redis - Base de Datos en Memoria (Cache & Real-time)

**Propósito:** Caché de alto rendimiento, contadores en tiempo real, trending.

**Puerto:** 6379  
**Tipo:** Key-Value Store en memoria

#### Estructuras de Datos Utilizadas:

##### Contadores de Likes (String)

**Implementación:** `/app/backend/app/main.py` - Líneas 1034-1047 (endpoint POST /posts/{post_id}/like)

**Estructura:**
```
Key: "post:{post_id}:likes:count"
Value: "25"
Tipo: String (usado como counter atómico)
```

**Comandos implementados:**
```python
# Línea 1045
pipe.incr(likes_count_key)    # Incrementa likes atómicamente
# Línea 1098
pipe.decr(likes_count_key)    # Decrementa likes (unlike)
```

**Decisión de diseño:**
Se eligió String porque Redis permite operaciones atómicas INCR/DECR sobre strings numéricos. Esto es crítico en una red social: múltiples usuarios pueden dar like simultáneamente sin race conditions. Redis garantiza atomicidad sin necesidad de locks, a diferencia de MongoDB donde necesitaríamos transacciones.

**Por qué no MongoDB para likes:**
MongoDB requeriría un update con $inc por cada like, lo cual toma ~10-50ms. Redis lo hace en <1ms. En una aplicación con millones de likes por día, esta diferencia es significativa en términos de escalabilidad y experiencia de usuario.

**Texto para presentación:**
"Los contadores de likes usan el tipo String de Redis con operaciones INCR atómicas. Elegimos Redis por tres razones: primero, latencia submilisegundo versus decenas de milisegundos en MongoDB; segundo, operaciones atómicas nativas sin necesidad de transacciones; tercero, la naturaleza volátil está bien aquí porque los contadores se pueden reconstruir desde MongoDB si es necesario. El comando INCR es O(1) y thread-safe."

##### Set de Usuarios que dieron Like (Set)

**Implementación:** `/app/backend/app/main.py` - Líneas 1034-1110

**Estructura:**
```
Key: "post:{post_id}:likes:users"
Value: {"rodrigo", "kam", "alice"}
Tipo: Set (colección no ordenada sin duplicados)
```

**Comandos implementados:**
```python
# Línea 1041 - Verificar si ya dio like
redis_client.sismember(likes_users_key, username)

# Línea 1046 - Agregar like
pipe.sadd(likes_users_key, username)

# Línea 1099 - Quitar like
pipe.srem(likes_users_key, username)
```

**Por qué Set y no List:**
Un Set garantiza unicidad automáticamente: un usuario no puede dar like dos veces al mismo post. Con List necesitaríamos verificar manualmente la existencia antes de agregar, lo cual requeriría dos operaciones. SISMEMBER verifica existencia en O(1) gracias al hash table interno de Redis.

**Por qué Set y no Hash:**
Aunque Hash también evita duplicados, Set es más apropiado cuando solo necesitamos almacenar usernames sin valores asociados. SADD en Set es más simple y eficiente que HSET en Hash para este caso de uso.

**Texto para presentación:**
"Usamos el tipo Set de Redis para almacenar qué usuarios dieron like porque los Sets garantizan unicidad automáticamente. La operación SISMEMBER verifica si un usuario ya dio like en O(1) usando una tabla hash interna. Esto es crucial antes de incrementar el contador: primero verificamos con SISMEMBER, y solo si retorna false, ejecutamos SADD e INCR en un pipeline atómico. El pipeline asegura que las dos operaciones se ejecuten como una transacción."

##### Trending Posts (Sorted Set)

**Implementación:** `/app/backend/app/main.py` - Líneas 1047 y 1181-1234

**Estructura:**
```
Key: "trending:posts"
Value: {post_id: score}
Tipo: Sorted Set (ZSET) - Set ordenado por score
```

**Estructura interna:**
```
"trending:posts" → {
  "post_abc123": 45,    // 45 likes
  "post_def456": 32,
  "post_ghi789": 18
}
```

**Comandos implementados:**
```python
# Línea 1047 - Incrementar score cuando hay like
pipe.zincrby("trending:posts", 1, post_id)

# Línea 1100 - Decrementar score cuando hay unlike
pipe.zincrby("trending:posts", -1, post_id)

# Línea 1187 - Obtener top 10 trending
trending = redis_client.zrevrange("trending:posts", 0, limit - 1, withscores=True)
```

**Por qué Sorted Set y no List ordenada:**
Sorted Set mantiene orden automático por score. Si usáramos List, necesitaríamos extraerla, reordenarla y guardarla de nuevo cada vez que hay un like, lo cual es O(n log n). Con ZINCRBY, actualizar el score es O(log n) y mantiene el orden automáticamente gracias a su implementación con skip list.

**Por qué Sorted Set y no múltiples Strings:**
Podríamos usar múltiples strings "post:{id}:score" pero entonces obtener el top 10 requeriría consultar todos los posts. Sorted Set permite ZREVRANGE que retorna los top N en O(log n + N), mucho más eficiente.

**Texto para presentación:**
"El trending usa Sorted Set, una estructura única de Redis que combina un Set con un ranking. Internamente usa una skip list que mantiene los elementos ordenados por score. Cada like ejecuta ZINCRBY que incrementa el score en O(log n) y reposiciona el post automáticamente. Para obtener los top 10, usamos ZREVRANGE que es O(log n + 10), independiente del total de posts. Esto es dramáticamente más eficiente que mantener el ranking en MongoDB, donde necesitaríamos un sort completo de O(n log n) cada vez."

##### Caché de Feeds (String con TTL)

**Implementación:** `/app/backend/app/main.py` - Líneas 578-633

**Estructura:**
```
Key: "feed:{username}:{mode}:{limit}"
Value: JSON serializado con lista de posts
TTL: 60 segundos (expiración automática)
```

**Comandos implementados:**
```python
# Línea 584 - Intentar leer del cache
cache_key = f"feed:{username}:{mode.value}:{limit}"
cached = r.get(cache_key)

# Línea 627 - Guardar en cache con TTL de 60 segundos
r.setex(cache_key, 60, json.dumps([p.dict() for p in posts]))

# Línea 330 - Invalidar cache después de follow/unfollow
pattern = f"feed:{username}:*"
for key in r.scan_iter(match=pattern):
    keys_to_delete.append(key)
r.delete(*keys_to_delete)
```

**Por qué String con JSON y no Hash:**
Redis Hash permitiría almacenar cada campo del post por separado, pero acceder al feed completo requeriría HGETALL y reconstruir los objetos. String con JSON serializado permite obtener todo el feed en una sola operación GET, reduciendo la latencia y el tráfico de red.

**Patrón Cache-Aside implementado:**
```python
# 1. Intenta cache (línea 584)
cached = r.get(cache_key)
if cached:
    return json.loads(cached)  # Hit: 1ms

# 2. Miss: consulta MongoDB + Neo4j (línea 600-623)
posts = query_database()

# 3. Actualiza cache (línea 627)
r.setex(cache_key, 60, json.dumps(posts))
```

**TTL de 60 segundos:**
El tiempo de expiración balancea frescura de datos vs hits de cache. Posts antiguos en el cache son aceptables por 60 segundos. Después, se recarga desde MongoDB para incluir nuevos posts. Eventos que requieren frescura inmediata (follow/unfollow/crear post) invalidan el cache manualmente con DEL.

**Texto para presentación:**
"El feed usa el patrón Cache-Aside con Redis. La clave incluye username, modo y limit para que cada variante tenga su propio cache. Primero intentamos GET en Redis que toma 1ms. Si hay miss, consultamos MongoDB y Neo4j, lo cual toma unos 50ms, y guardamos el resultado con SETEX que establece el valor y el TTL en una sola operación atómica. El TTL de 60 segundos significa que el cache expira automáticamente, sin necesidad de limpiezas manuales. Cuando un usuario hace follow o crea un post, invalidamos su cache con scan_iter y delete para forzar una recarga con datos frescos."

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
