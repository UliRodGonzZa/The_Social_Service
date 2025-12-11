# 🚀 Red K - Quick Start Local

## Solución Rápida al Error de Docker Compose

Si obtienes el error: `ERROR: Couldn't find env file: .env`

Usa el archivo simplificado:

```bash
docker-compose -f docker-compose.local.yml up -d
```

---

## Pasos Rápidos (5 minutos)

### 1. Levantar Bases de Datos
```bash
cd /ruta/a/tu/proyecto
docker-compose -f docker-compose.local.yml up -d
```

### 2. Verificar que estén corriendo
```bash
docker-compose -f docker-compose.local.yml ps
```

Deberías ver:
```
redk_mongo    mongo:7      Up      0.0.0.0:27017->27017/tcp
redk_redis    redis:7      Up      0.0.0.0:6379->6379/tcp
redk_neo4j    neo4j:5      Up      0.0.0.0:7474->7474/tcp, 0.0.0.0:7687->7687/tcp
```

### 3. Configurar Neo4j (Solo primera vez)
1. Abrir: http://localhost:7474
2. Usuario: `neo4j`
3. Password inicial: `neo4j`
4. Cambiar a: `password123`

### 4. Configurar Backend
```bash
cd backend

# Crear archivo .env
cat > .env << 'EOF'
MONGO_URI=mongodb://127.0.0.1:27017/red_k
REDIS_URL=redis://127.0.0.1:6379/0
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
EOF

# Instalar dependencias
pip install -r requirements.txt

# Iniciar backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 5. Configurar Frontend (Nueva terminal)
```bash
cd frontend

# Crear archivo .env
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
EOF

# Instalar dependencias
yarn install

# Iniciar frontend
yarn start
```

### 6. Poblar Datos (Nueva terminal)
```bash
cd backend

# Crear usuarios
python -m app.cli create-user alice alice@mail.com --name "Alice Smith" --bio "Developer"
python -m app.cli create-user bob bob@mail.com --name "Bob Jones" --bio "Designer"

# Crear relación
python -m app.cli follow-user alice bob

# Crear posts
python -m app.cli create-post alice "Mi primer post!" --tag "intro"
python -m app.cli create-post bob "Hello from Bob" --tag "intro"
```

---

## URLs Importantes

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8001 |
| Backend Docs | http://localhost:8001/docs |
| Neo4j Browser | http://localhost:7474 |

---

## Verificación Rápida

### Backend Health
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

### Crear usuario de prueba
```bash
cd backend
python -m app.cli create-user test test@mail.com --name "Test User"
```

### Ver usuarios
```bash
python -m app.cli list-users
```

---

## Comandos Útiles

```bash
# Detener bases de datos
docker-compose -f docker-compose.local.yml down

# Ver logs
docker-compose -f docker-compose.local.yml logs -f

# Reiniciar un servicio
docker-compose -f docker-compose.local.yml restart mongo

# Limpiar TODO (incluyendo datos)
docker-compose -f docker-compose.local.yml down -v
```

---

## Solución de Problemas

### Puerto ocupado
```bash
# MongoDB (27017)
lsof -i :27017
kill -9 <PID>

# Redis (6379)
lsof -i :6379
kill -9 <PID>

# Neo4j (7687)
lsof -i :7687
kill -9 <PID>
```

### Neo4j no inicia
```bash
# Ver logs
docker logs redk_neo4j

# Reiniciar
docker-compose -f docker-compose.local.yml restart neo4j
```

### Backend no conecta a bases de datos
```bash
# Verificar que estén corriendo
docker ps

# Verificar health
curl http://localhost:8001/health

# Ver logs del backend
# (en la terminal donde corre uvicorn)
```

---

## Diferencias entre docker-compose.yml y docker-compose.local.yml

### `docker-compose.yml` (Original)
- Incluye servicios `api` y `cli`
- Ejecuta el backend dentro de Docker
- Requiere archivo `.env` en la raíz
- Mejor para producción o despliegue completo

### `docker-compose.local.yml` (Desarrollo Local)
- Solo bases de datos (MongoDB, Redis, Neo4j)
- Backend y frontend corren en tu máquina
- NO requiere `.env` en la raíz
- Mejor para desarrollo local
- **Recomendado para empezar**

---

## Estructura de Archivos .env

### Raíz (opcional, solo para docker-compose.yml completo)
```
/.env
```

### Backend (REQUERIDO)
```
/backend/.env
```

### Frontend (REQUERIDO)
```
/frontend/.env
```

---

¿Todo funcionando? Continúa con el [README.md](README.md) completo para más detalles.
