# 🚀 Guía Rápida de Ejecución - Red K

Esta guía te ayudará a ejecutar el proyecto localmente en **5 minutos**.

---

## ✅ Pre-requisitos

Antes de comenzar, asegúrate de tener instalado:

- ✅ **Docker** y **Docker Compose**
- ✅ **Python 3.9+** con `pip`
- ✅ **Node.js 16+** con `yarn`

---

## 📋 Pasos de Ejecución

### **Paso 1: Levantar las Bases de Datos con Docker**

Desde la raíz del proyecto:

```bash
docker-compose up -d
```

**Verificar que todo está corriendo:**

```bash
docker-compose ps
```

Deberías ver 3 servicios activos:
- ✅ `mongo` (puerto 27017)
- ✅ `redis` (puerto 6379)  
- ✅ `neo4j` (puertos 7474, 7687)

---

### **Paso 2: Configurar Neo4j (Solo Primera Vez)**

1. Abrir en el navegador: http://localhost:7474
2. Login con:
   - Usuario: `neo4j`
   - Contraseña: `neo4j`
3. **Cambiar la contraseña a:** `password123`

---

### **Paso 3: Configurar Variables de Entorno**

#### Backend: `/backend/.env`

```bash
MONGO_URI=mongodb://127.0.0.1:27017/red_k
REDIS_URL=redis://127.0.0.1:6379/0
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
```

#### Frontend: `/frontend/.env`

```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

**⚠️ MUY IMPORTANTE**: El frontend debe apuntar al puerto **8001** (donde corre el backend).

---

### **Paso 4: Iniciar el Backend**

Abre una terminal en `/backend`:

```bash
cd backend

# Crear entorno virtual (si no existe)
python3 -m venv venv

# Activar entorno virtual
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Verificar que funciona:**

```bash
curl http://localhost:8001/api/health
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

✅ **Backend corriendo en:** http://localhost:8001

---

### **Paso 5: Iniciar el Frontend**

Abre **otra terminal** en `/frontend`:

```bash
cd frontend

# Instalar dependencias (solo primera vez)
yarn install

# Iniciar desarrollo
yarn start
```

✅ **Frontend abrirá automáticamente en:** http://localhost:3000

---

## 🎯 URLs Importantes

| Servicio | URL | Notas |
|----------|-----|-------|
| **Frontend** | http://localhost:3000 | Aplicación React |
| **Backend API** | http://localhost:8001/api | FastAPI con prefijo /api |
| **API Docs** | http://localhost:8001/docs | Swagger UI |
| **Neo4j Browser** | http://localhost:7474 | Usuario: neo4j / Pass: password123 |
| **MongoDB** | localhost:27017 | Base de datos: `red_k` |
| **Redis** | localhost:6379 | Cache |

---

## 🧪 Poblar Datos de Prueba

Una vez que el backend esté corriendo, abre una terminal en `/backend` y ejecuta:

```bash
cd backend
source venv/bin/activate

# Crear usuarios de prueba
python -m app.cli create-user rodrigo rodrigo@mail.com --name "Rodrigo González" --bio "Developer"
python -m app.cli create-user kam kam@mail.com --name "Kamila Torres" --bio "Designer"
python -m app.cli create-user alex alex@mail.com --name "Alex Ramírez" --bio "Engineer"

# Crear relaciones
python -m app.cli follow-user rodrigo kam
python -m app.cli follow-user rodrigo alex
python -m app.cli follow-user kam alex

# Crear posts
python -m app.cli create-post rodrigo "¡Hola a todos! Mi primer post" --tag "intro"
python -m app.cli create-post kam "Diseñando cosas increíbles" --tag "design"
python -m app.cli create-post alex "Backend es lo mejor" --tag "tech"

# Enviar mensajes directos
python -m app.cli send-dm rodrigo kam "Hola Kam! ¿Cómo estás?"
python -m app.cli send-dm kam rodrigo "¡Hola Rodrigo! Todo bien, gracias"
```

---

## 🎮 Probar la Aplicación

1. **Ir a:** http://localhost:3000
2. **Registrarse** con cualquier usuario (ej: `rodrigo` / `rodrigo@mail.com`)
3. **Explorar:**
   - 🏠 **Feed**: Ver posts propios y de seguidos
   - 🔥 **Trending**: Posts más populares
   - 🔍 **Descubrir**: Sugerencias de usuarios
   - 💬 **Mensajes**: Conversaciones privadas (DMs)
   - 👤 **Perfil**: Ver perfil de usuario

---

## 🛠️ Comandos Útiles del CLI

```bash
# Ver todos los usuarios
python -m app.cli list-users

# Seguir/Dejar de seguir
python -m app.cli follow-user <usuario> <target>
python -m app.cli unfollow-user <usuario> <target>

# Ver feed de un usuario
python -m app.cli get-feed <usuario> --limit 20

# Ver conversaciones
python -m app.cli list-dm-conversations <usuario>

# Leer conversación
python -m app.cli read-dm <usuario1> <usuario2>

# Enviar mensaje
python -m app.cli send-dm <sender> <receiver> "Tu mensaje aquí"

# Ver sugerencias
python -m app.cli suggest-users <usuario> --limit 10
```

---

## ❌ Solución de Problemas Comunes

### 🔴 "Connection refused" en el backend

**Problema:** Las bases de datos no están corriendo.

**Solución:**
```bash
docker-compose up -d
docker-compose ps  # Verificar que todo esté "Up"
```

---

### 🔴 Frontend no puede conectar al backend

**Problema:** Variable de entorno incorrecta.

**Solución:** Verificar `/frontend/.env`:
```bash
cat frontend/.env
# Debe decir: REACT_APP_BACKEND_URL=http://localhost:8001
```

Si está incorrecto, corrígelo y reinicia el frontend:
```bash
# Ctrl+C para detener
yarn start  # Reiniciar
```

---

### 🔴 Neo4j pide contraseña

**Problema:** Contraseña no actualizada.

**Solución:**
1. Ir a http://localhost:7474
2. Cambiar la contraseña a `password123`
3. O actualizar `NEO4J_PASSWORD` en `/backend/.env`

---

### 🔴 "Usuario no existe" en DMs

**Problema:** No hay usuarios en la base de datos.

**Solución:** Crear usuarios con el CLI (ver sección "Poblar Datos de Prueba").

---

### 🔴 Puertos ocupados

**Problema:** Los puertos ya están en uso.

**Solución:** Verificar qué está usando los puertos:
```bash
# Linux/Mac
lsof -i :3000   # Frontend
lsof -i :8001   # Backend
lsof -i :27017  # MongoDB
lsof -i :6379   # Redis
lsof -i :7687   # Neo4j

# Windows
netstat -ano | findstr :3000
```

---

## 🔄 Reiniciar Todo

Si algo falla, prueba reiniciar todo:

```bash
# Detener Docker
docker-compose down

# Detener backend y frontend (Ctrl+C en cada terminal)

# Reiniciar
docker-compose up -d
# Reiniciar backend (terminal 1)
# Reiniciar frontend (terminal 2)
```

---

## 📊 Verificar que Todo Funciona

### 1. Health Check del Backend
```bash
curl http://localhost:8001/api/health
```

Debe retornar `"status": "ok"` con todas las bases de datos en `true`.

### 2. Verificar Usuarios
```bash
cd backend && source venv/bin/activate
python -m app.cli list-users
```

### 3. Verificar Frontend
- Abrir http://localhost:3000
- Debe cargar la página de login/registro

---

## 🎉 ¡Listo!

Si todo está funcionando, deberías poder:
- ✅ Registrarte/Login
- ✅ Crear posts
- ✅ Dar likes
- ✅ Seguir usuarios
- ✅ Ver sugerencias
- ✅ Enviar mensajes directos

---

## 📚 Documentación Adicional

- **[README.md](README.md)** - Información general del proyecto
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Arquitectura NoSQL detallada
- **[CLI_GUIDE.md](CLI_GUIDE.md)** - Guía completa del CLI

---

## 💡 Consejos

1. **Mantén las 3 terminales abiertas:**
   - Terminal 1: Backend
   - Terminal 2: Frontend  
   - Terminal 3: CLI para comandos de prueba

2. **Hot Reload está activado:**
   - Los cambios en el backend se reflejan automáticamente
   - Los cambios en el frontend se reflejan automáticamente

3. **Usa el CLI para pruebas rápidas:**
   - Es más rápido crear usuarios y datos de prueba desde CLI
   - Útil para debugging

4. **Revisa los logs:**
   - Backend: Ver en la terminal donde corre
   - Frontend: Ver en la consola del navegador (F12)
   - Docker: `docker-compose logs <servicio>`

---

**¿Problemas?** Revisa la sección de solución de problemas arriba o abre un issue en GitHub.

**Red K** 🌐 - Tu red social con NoSQL
