# 🌐 Red K - Red Social con NoSQL

Red K es una aplicación de red social moderna construida con una arquitectura NoSQL híbrida, combinando MongoDB, Neo4j y Redis para diferentes propósitos.

## 🏗️ Arquitectura

- **Frontend**: React + Redux Toolkit + TailwindCSS
- **Backend**: FastAPI (Python)
- **Bases de Datos**:
  - **MongoDB**: Almacenamiento de documentos (usuarios, posts, mensajes)
  - **Neo4j**: Grafo social (relaciones, sugerencias)
  - **Redis**: Caché y contadores en tiempo real

## ✨ Funcionalidades

- ✅ **Autenticación**: Login y registro de usuarios
- ✅ **Feed de Posts**: Timeline personalizado con posts propios y de seguidos
- ✅ **Perfiles de Usuario**: Visualización de datos, posts y seguidores
- ✅ **Sistema de Seguir/Dejar de Seguir**: Red social dinámica
- ✅ **Descubrir**: Sugerencias inteligentes basadas en grafo social
- ✅ **Posts Trending**: Ranking de posts populares
- ✅ **Mensajes Directos**: Conversaciones privadas (en desarrollo)
- ✅ **CLI**: Herramientas de línea de comandos para gestión

---

## 🚀 Instalación Local

### 📋 Pre-requisitos

Asegúrate de tener instalado:
- **Docker** y **Docker Compose** (para las bases de datos)
- **Python 3.9+**
- **Node.js 16+** y **Yarn**
- **Git**

### 📥 Paso 1: Clonar el Repositorio

```bash
git clone <tu-repo-url>
cd red-k
```

### 🗄️ Paso 2: Levantar las Bases de Datos

El proyecto incluye un `docker-compose.yml` configurado:

```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Esto iniciará:
- **MongoDB** en puerto `27017`
- **Redis** en puerto `6379`
- **Neo4j** en puertos `7474` (web) y `7687` (driver)

**Verificar servicios:**
```bash
docker-compose ps
```

### ⚙️ Paso 3: Configurar Variables de Entorno

#### Backend (.env)

Crea `/backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/red_k
REDIS_URL=redis://127.0.0.1:6379/0
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
```

#### Frontend (.env)

Crea `/frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**⚠️ IMPORTANTE**: El frontend DEBE apuntar al puerto donde corre el backend (8001 por defecto).

### 🐍 Paso 4: Configurar el Backend

```bash
cd backend

# Crear entorno virtual (recomendado)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

### ⚛️ Paso 5: Configurar el Frontend

```bash
cd frontend

# Instalar dependencias
yarn install
```

### 🎬 Paso 6: Configurar Neo4j (Primera Vez)

1. Ir a http://localhost:7474 en tu navegador
2. Login con:
   - Usuario: `neo4j`
   - Contraseña: `neo4j`
3. Cambiar contraseña a: `password123`

### 🏃 Paso 7: Ejecutar la Aplicación

#### Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Verificar:**
```bash
curl http://localhost:8001/health
```

Debe retornar:
```json
{
  "status": "ok",
  "mongo": true,
  "redis": true,
  "neo4j": true
}
```

#### Terminal 2 - Frontend:
```bash
cd frontend
yarn start
```

La aplicación se abrirá en http://localhost:3000

---

## 🧪 Poblar Datos de Prueba

```bash
cd backend
source venv/bin/activate

# Crear usuarios
python -m app.cli create-user alice alice@mail.com --name "Alice Smith" --bio "Developer"
python -m app.cli create-user bob bob@mail.com --name "Bob Jones" --bio "Designer"
python -m app.cli create-user charlie charlie@mail.com --name "Charlie Davis" --bio "Engineer"

# Crear relaciones
python -m app.cli follow-user alice bob
python -m app.cli follow-user alice charlie

# Crear posts
python -m app.cli create-post alice "Mi primer post!" --tag "intro"
python -m app.cli create-post bob "Hello from Bob" --tag "intro"
python -m app.cli create-post charlie "Backend rocks!" --tag "tech"

# Crear mensajes
python -m app.cli send-dm alice bob "Hola Bob! ¿Cómo estás?"
python -m app.cli send-dm bob alice "¡Hola Alice! Todo bien"
```

---

## 📖 Documentación Adicional

- **[CLI Guide](/CLI_GUIDE.md)** - Guía completa del CLI
- **[Architecture](/ARCHITECTURE.md)** - Arquitectura NoSQL detallada

---

## 🎯 URLs Importantes

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| Frontend | http://localhost:3000 | - |
| Backend API | http://localhost:8001 | - |
| API Docs (Swagger) | http://localhost:8001/docs | - |
| Neo4j Browser | http://localhost:7474 | neo4j/password123 |

---

## 🛠️ Comandos CLI Útiles

```bash
# Usuarios
python -m app.cli list-users
python -m app.cli create-user <username> <email> --name "<nombre>" --bio "<bio>"
python -m app.cli follow-user <user> <target>
python -m app.cli list-following <username>

# Posts
python -m app.cli create-post <username> "<contenido>" --tag "<tag>"
python -m app.cli get-feed <username> --limit 20

# Mensajes
python -m app.cli send-dm <sender> <receiver> "<mensaje>"
python -m app.cli read-dm <user1> <user2>
python -m app.cli list-dm-conversations <username>

# Sugerencias
python -m app.cli suggest-users <username> --limit 10
```

---

## 🗄️ Esquema de Bases de Datos

### MongoDB
```javascript
// Colección: users
{
  "_id": ObjectId,
  "username": String,
  "email": String,
  "name": String,
  "bio": String
}

// Colección: posts
{
  "_id": ObjectId,
  "author_username": String,
  "content": String,
  "tags": [String],
  "created_at": DateTime
}

// Colección: dms
{
  "_id": ObjectId,
  "sender_username": String,
  "receiver_username": String,
  "content": String,
  "created_at": DateTime,
  "read": Boolean
}
```

### Neo4j
```cypher
// Nodos
(:User {id, username, email, name, bio})
(:Post {id, content, created_at})

// Relaciones
(User)-[:FOLLOWS]->(User)
(User)-[:POSTED]->(Post)
(User)-[:LIKES]->(Post)
(User)-[:MESSAGED]->(User)
```

### Redis
```
# Caché de feeds
feed:{username}:{mode}:{limit}  // TTL: 60s

# Contadores de likes
post:{post_id}:likes:count
post:{post_id}:likes:users  // SET

# Trending posts
trending:posts  // Sorted Set
```

---

## 🆘 Solución de Problemas

### Docker no inicia
```bash
# Verificar Docker
docker ps

# Verificar puertos libres
lsof -i :27017  # MongoDB
lsof -i :6379   # Redis
lsof -i :7687   # Neo4j
```

### Backend no conecta
```bash
# Verificar health endpoint
curl http://localhost:8001/health

# Revisar logs
docker-compose logs mongo
docker-compose logs redis
docker-compose logs neo4j
```

### Frontend no carga
```bash
# Verificar .env
cat frontend/.env
# Debe ser: REACT_APP_BACKEND_URL=http://localhost:8001

# Limpiar cache y reinstalar
cd frontend
rm -rf node_modules
yarn install
yarn start
```

### Neo4j pide contraseña
```bash
# Conectar a http://localhost:7474
# Cambiar contraseña de neo4j a password123
# O actualizar backend/.env con tu contraseña
```

---

## 📊 Integración NoSQL - Flujos Principales

### Crear Usuario
1. **MongoDB**: INSERT documento en `users`
2. **Neo4j**: CREATE nodo `(:User)`
3. Si Neo4j falla → Error 500

### Seguir Usuario
1. **MongoDB**: Validar usuarios existen
2. **Neo4j**: CREATE `(User)-[:FOLLOWS]->(User)`
3. **Redis**: INVALIDATE caché de feeds

### Crear Post
1. **MongoDB**: INSERT documento en `posts`
2. **Neo4j**: CREATE `(Post)` + `(User)-[:POSTED]->(Post)`
3. **Redis**: INVALIDATE caché feed del autor

### Ver Feed
1. **Redis**: CHECK cache → Si existe, return
2. **Neo4j**: GET usuarios seguidos
3. **MongoDB**: GET posts de seguidos
4. **Redis**: CACHE resultado (60s TTL)

---

## 📁 Estructura del Proyecto

```
red-k/
├── docker-compose.yml          # Configuración bases de datos
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── cli.py             # CLI tools
│   │   └── redis_cluster.py   # Redis helpers
│   ├── requirements.txt
│   ├── server.py              # Entry point (monta /api prefix)
│   └── .env                   # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── app/
│   │   │   └── store.js       # Redux store
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── feed/
│   │   │   ├── posts/
│   │   │   ├── profile/
│   │   │   ├── users/
│   │   │   └── messages/
│   │   ├── pages/
│   │   │   ├── FeedPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── DiscoverPage.jsx
│   │   │   ├── TrendingPage.jsx
│   │   │   └── MessagesPage.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Loader.jsx
│   │   └── services/
│   │       └── api.js         # Axios client
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env
├── ARCHITECTURE.md            # Documentación NoSQL
├── CLI_GUIDE.md              # Guía del CLI
└── README.md                 # Este archivo
```

---

## 🚀 Comandos Útiles

```bash
# Detener todo
docker-compose down
# Ctrl+C en terminales de backend y frontend

# Limpiar bases de datos (¡CUIDADO!)
docker-compose down -v

# Reiniciar un servicio
docker-compose restart mongo

# Ver logs
docker-compose logs -f mongo
docker-compose logs -f redis
docker-compose logs -f neo4j

# Limpiar cache Python
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete

# Limpiar node_modules
cd frontend && rm -rf node_modules && yarn install
```

---

## 📝 Notas Importantes

1. **Prefijo /api**: Todas las rutas del backend incluyen `/api` por diseño (ej: `/api/users/`, `/api/posts/`)
2. **Hot Reload**: Backend y frontend tienen hot-reload habilitado para desarrollo
3. **CORS**: Configurado para permitir requests desde `localhost:3000`
4. **MongoDB Database**: El nombre de la base de datos es `red_k` (especificado explícitamente)
5. **Redis TTL**: Los feeds se cachean por 60 segundos
6. **Neo4j Password**: Debe ser `password123` o actualizar en `.env`

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

## 👥 Autores

- **Tu Nombre** - Desarrollo inicial

---

## 🙏 Agradecimientos

- FastAPI por el excelente framework de Python
- React y Redux Toolkit por el stack de frontend
- MongoDB, Neo4j y Redis por las bases de datos NoSQL
- TailwindCSS por el sistema de diseño

---

## 📞 Soporte

¿Tienes preguntas o problemas? Abre un issue en GitHub o contacta al equipo de desarrollo.

---

**Red K** - Construyendo conexiones con NoSQL 🌐
