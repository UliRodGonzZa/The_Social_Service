# 🏠 Configuración para Desarrollo Local

## 🔴 PROBLEMA: Login no funciona en local

**Causa:** El archivo `.env` del frontend está configurado para Emergent, no para tu máquina local.

---

## ✅ SOLUCIÓN RÁPIDA (2 minutos)

### Paso 1: Configurar Frontend

En tu máquina local, **edita o crea** `/frontend/.env`:

```bash
cd frontend

# Opción A: Copiar desde ejemplo
cp .env.local.example .env

# Opción B: Crear manualmente
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
```

**Contenido del archivo `/frontend/.env`:**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Paso 2: Reiniciar Frontend

```bash
# Si ya estaba corriendo, detenerlo (Ctrl+C)
# Luego:
yarn start
```

### Paso 3: Probar Login

1. Abrir http://localhost:3000
2. Intentar login
3. Debería funcionar ✅

---

## 📝 Configuración Completa del Proyecto

### Backend `.env`

**Ubicación:** `/backend/.env`

```env
MONGO_URI=mongodb://127.0.0.1:27017/red_k
REDIS_URL=redis://127.0.0.1:6379/0
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Opcional: Para dashboard de observability
OBSERVABILITY_MODE=production
```

### Frontend `.env`

**Ubicación:** `/frontend/.env`

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

⚠️ **MUY IMPORTANTE:** El frontend DEBE apuntar al puerto donde corre tu backend (8001 por defecto).

---

## 🚀 Pasos Completos para Ejecutar el Proyecto

### 1. Iniciar Bases de Datos (Docker)

```bash
cd /ruta/a/tu/proyecto
docker-compose up -d
```

**Verificar:**
```bash
docker-compose ps
# Deberías ver: mongo, redis, neo4j (y opcionalmente redis-master-*, etc)
```

### 2. Configurar Neo4j (Solo Primera Vez)

```bash
# Abrir en navegador: http://localhost:7474
# Login: neo4j / neo4j
# Cambiar password a: password123
```

### 3. Iniciar Backend

```bash
cd backend

# Crear entorno virtual (si no existe)
python3 -m venv venv

# Activar entorno virtual
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Verificar .env
cat .env  # Debe tener MONGO_URI, etc.

# Iniciar servidor
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Verificar backend funciona:**
```bash
curl http://localhost:8001/api/health
# Debe retornar: {"status": "ok", ...}
```

### 4. Iniciar Frontend

**En otra terminal:**

```bash
cd frontend

# Instalar dependencias (solo primera vez)
yarn install

# ⚠️ IMPORTANTE: Verificar .env
cat .env
# Debe decir: REACT_APP_BACKEND_URL=http://localhost:8001

# Si no existe o está mal, corregir:
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# Iniciar desarrollo
yarn start
```

**El navegador abrirá automáticamente en:** http://localhost:3000

### 5. Probar Login

1. Ir a http://localhost:3000
2. Registrarse o hacer login
3. Debería funcionar ✅

---

## 🔍 Diferencias entre Local y Emergent

| Aspecto | Local | Emergent |
|---------|-------|----------|
| **Backend URL** | `http://localhost:8001` | `https://socialfastapi.preview.emergentagent.com` |
| **Frontend Puerto** | 3000 | 3000 |
| **MongoDB** | Docker en 127.0.0.1:27017 | Supervisor |
| **Redis** | Docker en 127.0.0.1:6379 | No disponible |
| **Neo4j** | Docker en 127.0.0.1:7687 | No disponible |
| **Redis Cluster** | Docker (masters + replicas) | No disponible |

---

## 🐛 Troubleshooting

### ❌ Login falla con "Network Error"

**Causa:** Frontend no puede conectar al backend.

**Verificar:**
```bash
# 1. Backend está corriendo
curl http://localhost:8001/api/health

# 2. .env del frontend está correcto
cat frontend/.env

# 3. Frontend está usando la variable
# Abrir navegador → F12 → Console
# Buscar: "API Base URL: http://localhost:8001"
```

**Solución:**
```bash
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
# Ctrl+C para detener frontend
yarn start  # Reiniciar
```

### ❌ "ModuleNotFoundError: No module named 'app.observability'"

**Solución:** Ya está arreglado en el código actual. Simplemente:
```bash
git pull origin main  # Actualizar código
# O ignorar el error - backend arrancará igual
```

### ❌ "Connection refused" a MongoDB/Redis/Neo4j

**Causa:** Docker no está corriendo.

**Solución:**
```bash
docker-compose up -d
docker-compose ps  # Verificar que todo esté "Up"
```

### ❌ "Can't connect to Neo4j"

**Causa:** Neo4j requiere cambio de password inicial.

**Solución:**
```bash
# 1. Ir a http://localhost:7474
# 2. Login: neo4j / neo4j
# 3. Cambiar password a: password123
# 4. Reiniciar backend
```

### ❌ Frontend muestra página en blanco

**Solución:**
```bash
# 1. Verificar console del navegador (F12)
# 2. Buscar errores
# 3. Verificar que .env esté correcto
# 4. Limpiar cache y reinstalar
cd frontend
rm -rf node_modules
yarn install
yarn start
```

---

## 📋 Checklist Pre-Login

Antes de intentar login, verificar:

- [ ] Docker está corriendo: `docker-compose ps`
- [ ] MongoDB responde: `curl http://localhost:27017`
- [ ] Backend está corriendo: `curl http://localhost:8001/api/health`
- [ ] Frontend `.env` dice: `REACT_APP_BACKEND_URL=http://localhost:8001`
- [ ] Frontend está corriendo: navegador en http://localhost:3000
- [ ] Neo4j password cambiado a `password123`

---

## ✅ Resumen de la Solución

**El problema principal es el `.env` del frontend.**

**En LOCAL necesitas:**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**En EMERGENT necesita:**
```env
REACT_APP_BACKEND_URL=https://socialfastapi.preview.emergentagent.com
```

**Acción:**
1. Edita `/frontend/.env` en tu local
2. Pon: `REACT_APP_BACKEND_URL=http://localhost:8001`
3. Reinicia frontend
4. Login funcionará ✅

---

## 🎯 Próximos Pasos

Una vez que login funcione:

1. **Crear usuarios de prueba:**
   ```bash
   cd backend
   source venv/bin/activate
   python -m app.cli create-user rodrigo rodrigo@mail.com
   python -m app.cli create-user kam kam@mail.com
   ```

2. **Probar funcionalidades:**
   - Posts, likes, follow
   - Mensajes directos
   - Dashboard de observability (si Redis Cluster está configurado)

3. **Desarrollar:**
   - Backend con hot reload activo
   - Frontend con hot reload activo
   - Cambios se reflejan automáticamente

---

**Con estos cambios, el login debería funcionar perfectamente en tu local.** 🎉
