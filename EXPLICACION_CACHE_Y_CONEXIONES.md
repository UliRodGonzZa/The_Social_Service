# Explicación Detallada: Cache Redis y Conexiones

## 1. CÓMO FUNCIONA EL CACHE DE REDIS

### Patrón Cache-Aside (Lazy Loading)

**Ubicación del código:** `/app/backend/app/main.py` - Función `get_user_feed()` líneas 564-633

### Flujo Completo Paso a Paso:

```python
# PASO 1: Construir la clave del cache
cache_key = f"feed:{username}:{mode.value}:{limit}"
# Ejemplo: "feed:rodrigo:all:20"

# PASO 2: Intentar leer del cache (Cache Hit o Miss)
try:
    r = get_redis_client()  # Conecta a Redis
    cached = r.get(cache_key)  # Busca la clave en Redis
    
    if cached:  # CACHE HIT
        data = json.loads(cached)  # Deserializa el JSON
        return data  # Retorna en ~1ms
except Exception:
    r = None  # Si Redis falla, continúa sin cache

# PASO 3: CACHE MISS - Consultar las bases de datos
# 3a. Obtener usuarios que sigo desde Neo4j
driver = get_neo4j_driver()
with driver.session() as session:
    result = session.run(
        "MATCH (u:User {id: $user_id})-[:FOLLOWS]->(f:User) RETURN f.username",
        user_id=user_id
    )
    followed_usernames = [record["username"] for record in result]

# 3b. Construir lista de autores (yo + quienes sigo)
authors = [username] + followed_usernames

# 3c. Obtener posts desde MongoDB
db = get_mongo_db()
posts_col = db["posts"]
cursor = posts_col.find(
    {"author_username": {"$in": authors}}
).sort("created_at", -1).limit(limit)

posts = [PostOut(...) for d in cursor]

# PASO 4: Guardar en cache para próximas consultas
if r is not None:
    try:
        # SETEX hace dos cosas atómicamente:
        # 1. SET: Guarda el valor
        # 2. EXPIRE: Establece TTL de 60 segundos
        r.setex(
            cache_key,                           # Clave
            60,                                  # TTL en segundos
            json.dumps([p.dict() for p in posts]) # Valor serializado
        )
    except Exception:
        pass  # Si falla, no importa, ya tenemos los datos

# PASO 5: Retornar los posts
return posts  # Esta vez tomó ~50-100ms
```

### ¿Por qué 60 segundos de TTL?

**Balance entre frescura y eficiencia:**
- Demasiado corto (5s): Muchos cache misses, Redis se usa poco
- Demasiado largo (5min): Datos obsoletos, nuevos posts tardan en aparecer
- 60 segundos: Punto medio razonable para una red social

### Invalidación Manual del Cache

Cuando ocurren eventos que requieren actualización inmediata:

**Ubicación:** `/app/backend/app/main.py` - Líneas 329-344

```python
# Después de hacer follow/unfollow
try:
    r = get_redis_client()
    if r is not None:
        # Buscar todas las claves del feed de este usuario
        pattern = f"feed:{username}:*"
        keys_to_delete = []
        
        # scan_iter es mejor que keys() porque no bloquea Redis
        for key in r.scan_iter(match=pattern):
            keys_to_delete.append(key)
        
        # Borrar todas las variantes del feed
        if keys_to_delete:
            r.delete(*keys_to_delete)
            print(f"Invalidado cache de feed para {username}: {len(keys_to_delete)} keys")
except Exception as e:
    print(f"No se pudo invalidar cache: {e}")
```

**¿Qué invalida el cache?**
1. Follow/Unfollow: Cambia quiénes aparecen en tu feed
2. Crear post: No invalida porque el post aparecerá en máximo 60s
3. Logout: No es necesario, el cache es por servidor, no por sesión

---

## 2. CÓMO VER EL CACHE EN REDIS

### Opción 1: Redis CLI (Línea de Comandos)

```bash
# Conectarse a Redis
redis-cli

# Ver todas las claves
127.0.0.1:6379> KEYS *

# Resultado ejemplo:
1) "feed:rodrigo:all:20"
2) "post:abc123:likes:count"
3) "post:abc123:likes:users"
4) "trending:posts"

# Ver el contenido de una clave específica
127.0.0.1:6379> GET "feed:rodrigo:all:20"

# Ver el TTL (tiempo restante antes de expiración)
127.0.0.1:6379> TTL "feed:rodrigo:all:20"
(integer) 45   # Quedan 45 segundos

# Ver el tipo de estructura
127.0.0.1:6379> TYPE "feed:rodrigo:all:20"
string

127.0.0.1:6379> TYPE "post:abc123:likes:users"
set

127.0.0.1:6379> TYPE "trending:posts"
zset

# Ver contenido de un Set
127.0.0.1:6379> SMEMBERS "post:abc123:likes:users"
1) "rodrigo"
2) "kam"
3) "alice"

# Ver contenido de un Sorted Set
127.0.0.1:6379> ZREVRANGE "trending:posts" 0 9 WITHSCORES
1) "post_abc123"
2) "45"
3) "post_def456"
4) "32"

# Monitorear en tiempo real todas las operaciones
127.0.0.1:6379> MONITOR
OK
1702845678.123456 [0 127.0.0.1:54321] "GET" "feed:rodrigo:all:20"
1702845679.234567 [0 127.0.0.1:54322] "INCR" "post:abc123:likes:count"
```

### Opción 2: Desde Python (Para Debugging)

Crear archivo `/app/backend/scripts/debug_redis.py`:

```python
import redis
import json
from pprint import pprint

# Conectar a Redis
r = redis.from_url("redis://127.0.0.1:6379/0")

print("=== CLAVES EN REDIS ===")
for key in r.scan_iter(match="*"):
    key_str = key.decode('utf-8') if isinstance(key, bytes) else key
    key_type = r.type(key).decode('utf-8')
    ttl = r.ttl(key)
    
    print(f"\nClave: {key_str}")
    print(f"Tipo: {key_type}")
    print(f"TTL: {ttl}s" if ttl > 0 else "TTL: Sin expiración")
    
    # Mostrar contenido según el tipo
    if key_type == 'string':
        value = r.get(key)
        if value:
            value_str = value.decode('utf-8')
            # Si es JSON, formatearlo
            try:
                data = json.loads(value_str)
                print(f"Valor: {json.dumps(data, indent=2)[:200]}...")
            except:
                print(f"Valor: {value_str[:100]}...")
    
    elif key_type == 'set':
        members = r.smembers(key)
        print(f"Miembros ({len(members)}): {members}")
    
    elif key_type == 'zset':
        items = r.zrevrange(key, 0, 4, withscores=True)
        print(f"Top 5: {items}")

print("\n=== ESTADÍSTICAS ===")
info = r.info('stats')
print(f"Comandos totales: {info['total_commands_processed']}")
print(f"Hits: {info.get('keyspace_hits', 0)}")
print(f"Misses: {info.get('keyspace_misses', 0)}")
hit_rate = info.get('keyspace_hits', 0) / (info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1)) * 100
print(f"Hit Rate: {hit_rate:.2f}%")
```

**Ejecutar:**
```bash
cd /app/backend
python scripts/debug_redis.py
```

### Opción 3: Probar el Cache Manualmente

```bash
# 1. Ver estado inicial
redis-cli KEYS "feed:*"
# (empty array) - No hay cache

# 2. Hacer petición al feed (desde otro terminal)
curl http://localhost:8001/api/users/rodrigo/feed?limit=20

# 3. Verificar que se creó el cache
redis-cli KEYS "feed:*"
# 1) "feed:rodrigo:all:20"

# 4. Ver el contenido
redis-cli GET "feed:rodrigo:all:20"

# 5. Ver cuánto tiempo queda
redis-cli TTL "feed:rodrigo:all:20"
# (integer) 54

# 6. Esperar 60 segundos y verificar que expiró
sleep 60
redis-cli GET "feed:rodrigo:all:20"
# (nil) - Ya no existe

# 7. Invalidación manual
redis-cli DEL "feed:rodrigo:all:20"
# (integer) 1 - Se borró 1 clave
```

---

## 3. CONEXIÓN FRONTEND - BACKEND - BASE DE DATOS

### Arquitectura de 3 Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR (Cliente)                       │
│                   http://localhost:3000                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
                           │ (fetch/axios)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               BACKEND (FastAPI Server)                       │
│              http://localhost:8001/api                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ server.py                                           │    │
│  │  - Punto de entrada                                │    │
│  │  - Monta main.py con prefix="/api"                 │    │
│  │  - Configura CORS                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ main.py                                             │    │
│  │  - Endpoints: /users/, /posts/, /dm/, /admin/     │    │
│  │  - Lógica de negocio                              │    │
│  │  - Validación con Pydantic                        │    │
│  └────────────────────────────────────────────────────┘    │
│              │              │              │                 │
└──────────────┼──────────────┼──────────────┼─────────────────┘
               │              │              │
               ↓              ↓              ↓
    ┌────────────┐  ┌─────────────┐  ┌──────────┐
    │  MongoDB   │  │   Redis     │  │  Neo4j   │
    │  :27017    │  │   :6379     │  │  :7687   │
    └────────────┘  └─────────────┘  └──────────┘
```

### FLUJO COMPLETO: Usuario solicita su Feed

#### PASO 1: Frontend React inicia la petición

**Archivo:** `/app/frontend/src/pages/FeedPage.jsx` - Líneas 20-45

```javascript
// Componente React
function FeedPage() {
  const [posts, setPosts] = useState([]);
  const username = useSelector((state) => state.auth.user?.username);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      // AQUÍ SE HACE LA CONEXIÓN AL BACKEND
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/${username}/feed?mode=all&limit=20`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      const data = await response.json();
      setPosts(data); // Actualiza el estado de React
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
    </div>
  );
}
```

**Variable de entorno crítica:**

**Archivo:** `/app/frontend/.env`
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

Esta variable define DÓNDE está el backend. React reemplaza `process.env.REACT_APP_BACKEND_URL` en tiempo de compilación.

#### PASO 2: Request HTTP viaja por la red

```
GET http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20
Headers:
  Content-Type: application/json
  Origin: http://localhost:3000
```

#### PASO 3: Backend recibe la petición

**Archivo:** `/app/backend/server.py` - Líneas 13-28

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.main import app as main_app

app = FastAPI(title="Red K API")

# CORS: Permite que frontend (puerto 3000) hable con backend (puerto 8001)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción: solo el dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monta la aplicación principal con prefix /api
app.mount("/api", main_app)
```

**¿Qué es CORS?**
Por seguridad, navegadores bloquean requests entre dominios diferentes. CORS (Cross-Origin Resource Sharing) le dice al navegador: "Está bien, permito que localhost:3000 me hable".

#### PASO 4: Enrutamiento al endpoint correcto

FastAPI analiza la URL `/api/users/rodrigo/feed` y busca el handler correspondiente.

**Archivo:** `/app/backend/app/main.py` - Líneas 564-567

```python
@app.get("/users/{username}/feed", response_model=List[PostOut])
def get_user_feed(
    username: str,          # Extraído de la URL
    limit: int = 20,        # Query parameter
    mode: FeedMode = FeedMode.all,  # Query parameter
):
```

FastAPI automáticamente:
1. Extrae `username` de la ruta
2. Extrae `limit` y `mode` de los query parameters
3. Valida los tipos
4. Convierte `mode` al enum `FeedMode`

#### PASO 5: Conexiones a las Bases de Datos

**5a. Conexión a Redis (cache)**

**Archivo:** `/app/backend/app/main.py` - Líneas 164-166

```python
def get_redis_client():
    return redis.from_url(REDIS_URL)

# Uso en el endpoint
r = get_redis_client()
cached = r.get(cache_key)
```

**Variable de entorno:**
```python
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
```

**¿Cómo funciona redis.from_url?**
1. Parsea la URL: `redis://host:port/db`
2. Crea un connection pool (reutiliza conexiones TCP)
3. Conecta al servidor Redis usando el protocolo RESP
4. Cada llamada a `.get()`, `.set()`, etc. usa una conexión del pool

**5b. Conexión a Neo4j (relaciones)**

**Archivo:** `/app/backend/app/main.py` - Líneas 168-169

```python
def get_neo4j_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# Uso en el endpoint
driver = get_neo4j_driver()
with driver.session() as session:
    result = session.run(
        "MATCH (u:User {id: $user_id})-[:FOLLOWS]->(f:User) RETURN f.username",
        user_id=user_id
    )
```

**Variables de entorno:**
```python
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")
```

**¿Qué es el protocolo Bolt?**
- Protocolo binario de Neo4j (más eficiente que HTTP)
- Puerto 7687 por defecto
- Soporta streaming de resultados

**5c. Conexión a MongoDB (datos principales)**

**Archivo:** `/app/backend/app/mongo.py` - Líneas 11-42

```python
from pymongo import MongoClient

_client = None
_db = None

def _connect():
    """Patrón Singleton: una sola conexión global"""
    global _client, _db

    if _client is None:
        try:
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            _client.admin.command("ping")  # Verifica conectividad
            _db = _client[MONGO_DB_NAME]
            print(f"[MongoDB] Conectado a {MONGO_URI} / DB={MONGO_DB_NAME}")
        except ConnectionFailure as e:
            print(f"[MongoDB] Error: {e}")
            raise e
    
    return _db

def get_mongo_db():
    return _connect()
```

**Uso en el endpoint:**
```python
db = get_mongo_db()
posts_col = db["posts"]
posts = list(posts_col.find({"author_username": {"$in": authors}}).sort("created_at", -1))
```

**¿Por qué Singleton?**
PyMongo maneja un connection pool interno. Crear múltiples MongoClient es ineficiente. El patrón Singleton asegura que toda la aplicación use la misma instancia.

#### PASO 6: Backend retorna la respuesta

```python
return posts  # FastAPI serializa automáticamente a JSON
```

FastAPI hace:
1. Valida que `posts` coincida con `List[PostOut]` (Pydantic)
2. Serializa cada PostOut a diccionario
3. Convierte a JSON
4. Agrega headers HTTP apropiados
5. Envía la respuesta

#### PASO 7: Frontend recibe y renderiza

```javascript
const data = await response.json();  // Parsea JSON
setPosts(data);  // Actualiza estado de React
// React re-renderiza automáticamente el componente
```

---

## DIAGRAMA DE SECUENCIA COMPLETO

```
Usuario          React           Backend         Redis      Neo4j     MongoDB
  |                |                |              |          |           |
  |-- Click Feed --|                |              |          |           |
  |                |-- GET /feed -->|              |          |           |
  |                |                |-- GET cache ->          |           |
  |                |                |<--- MISS ---|          |           |
  |                |                |-- MATCH follows ------->|           |
  |                |                |<--- [users] ------------|           |
  |                |                |-- find({$in: users}) ------------->|
  |                |                |<--- [posts] -----------------------|
  |                |                |-- SETEX cache ->        |           |
  |                |<--- [posts] ---|              |          |           |
  |<--- Renderiza -|                |              |          |           |
```

---

## VERIFICAR CONEXIONES

### 1. Verificar que Redis está conectado

```bash
# Desde el backend
cd /app/backend
python -c "
import redis
r = redis.from_url('redis://127.0.0.1:6379/0')
print('Ping:', r.ping())  # True si conectado
print('Info:', r.info('server')['redis_version'])
"
```

### 2. Verificar que Neo4j está conectado

```bash
python -c "
from neo4j import GraphDatabase
driver = GraphDatabase.driver('bolt://127.0.0.1:7687', auth=('neo4j', 'password123'))
driver.verify_connectivity()
print('Neo4j conectado!')
driver.close()
"
```

### 3. Verificar que MongoDB está conectado

```bash
python -c "
from pymongo import MongoClient
client = MongoClient('mongodb://127.0.0.1:27017/red_k')
client.admin.command('ping')
print('MongoDB conectado!')
print('Bases de datos:', client.list_database_names())
"
```

### 4. Verificar que Frontend se conecta al Backend

```bash
# Desde el navegador, abrir consola (F12) y ejecutar:
fetch('http://localhost:8001/api/health')
  .then(r => r.json())
  .then(data => console.log(data))
```

---

## RESUMEN PARA PRESENTACIÓN

**Texto sugerido:**

"La aplicación usa una arquitectura de tres capas. El frontend React corre en puerto 3000 y usa la variable de entorno REACT_APP_BACKEND_URL para saber dónde está el backend. 

El backend FastAPI corre en puerto 8001 y usa el patrón de connection pooling para las tres bases de datos. Para Redis usamos redis.from_url que crea un pool de conexiones reutilizables. Para Neo4j usamos el driver oficial con protocolo Bolt. Para MongoDB implementamos un patrón Singleton que garantiza una única conexión global.

El cache funciona con el patrón Cache-Aside: primero intentamos GET en Redis, si hay miss consultamos las bases de datos reales, y guardamos el resultado con SETEX que establece valor y TTL atómicamente. El TTL de 60 segundos balancea entre frescura de datos y eficiencia. Cuando hay eventos críticos como follow o unfollow, invalidamos el cache manualmente con DEL para forzar actualización inmediata.

La comunicación entre frontend y backend usa HTTP REST, con CORS configurado para permitir requests cross-origin entre los dos puertos diferentes."
