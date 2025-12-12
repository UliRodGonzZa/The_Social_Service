# 🔍 Diagnóstico: Login no funciona

## 🔴 Error Observado

```
INFO: 127.0.0.1:36908 - "GET /api/users/by-username/kam HTTP/1.1" 404 Not Found
```

**Significado:** El frontend intenta obtener el usuario "kam" pero no existe en tu base de datos local.

---

## ✅ Solución Paso a Paso

### Paso 1: Verificar que MongoDB esté corriendo

```bash
docker-compose ps
```

**Debe mostrar:**
```
NAME                COMMAND                  SERVICE   STATUS
...
mongo               "docker-entrypoint.s…"   mongo     Up
```

**Si no está corriendo:**
```bash
docker-compose up -d mongo
```

### Paso 2: Verificar usuarios en MongoDB

**Opción A - Usar script de Python:**
```bash
cd /ruta/a/tu/proyecto

# Desde la raíz del proyecto
python3 scripts/setup_test_users.py
```

**Opción B - Usar mongosh (si lo tienes instalado):**
```bash
mongosh mongodb://127.0.0.1:27017/red_k

# Dentro de mongosh:
db.users.find({}, {username: 1, email: 1})
```

**Opción C - Verificar con Python directamente:**
```bash
cd backend
source venv/bin/activate

python3 << 'EOF'
from pymongo import MongoClient
client = MongoClient("mongodb://127.0.0.1:27017/red_k")
db = client.get_database("red_k")
users = list(db["users"].find({}, {"username": 1, "email": 1}))
print(f"Total usuarios: {len(users)}")
for u in users:
    print(f"  - {u['username']}")
client.close()
EOF
```

### Paso 3: Crear usuarios de prueba

Si no hay usuarios (o muy pocos), usa el CLI:

```bash
cd backend
source venv/bin/activate

# Crear usuarios
python -m app.cli create-user rodrigo rodrigo@mail.com --name "Rodrigo" --bio "Dev"
python -m app.cli create-user kam kam@mail.com --name "Kamila" --bio "Designer"
python -m app.cli create-user alex alex@mail.com --name "Alex" --bio "Engineer"

# Verificar
python -m app.cli list-users
```

**O usar el script:**
```bash
python3 scripts/setup_test_users.py
```

### Paso 4: Probar endpoint directamente

```bash
# Probar que el endpoint funciona
curl http://localhost:8001/api/users/by-username/rodrigo

# Debe retornar JSON del usuario
```

### Paso 5: Probar login desde frontend

1. Abrir http://localhost:3000
2. Intentar login con usuario existente (ej: `rodrigo`)
3. Debería funcionar ✅

---

## 🔍 Diagnóstico Completo

### Checklist de Verificación

Ejecuta estos comandos en orden:

```bash
# 1. ¿MongoDB está corriendo?
docker-compose ps | grep mongo
# Esperado: "Up"

# 2. ¿Puedo conectar a MongoDB?
curl http://localhost:27017
# Esperado: mensaje de MongoDB

# 3. ¿El backend está corriendo?
curl http://localhost:8001/api/health
# Esperado: {"status": "ok", ...}

# 4. ¿Hay usuarios en la BD?
cd backend
python3 << 'EOF'
from pymongo import MongoClient
client = MongoClient("mongodb://127.0.0.1:27017/red_k")
print(f"Usuarios: {client.red_k.users.count_documents({})}")
EOF
# Esperado: número > 0

# 5. ¿El endpoint de usuarios funciona?
curl http://localhost:8001/api/users/
# Esperado: array de usuarios

# 6. ¿Puedo obtener un usuario específico?
curl http://localhost:8001/api/users/by-username/rodrigo
# Esperado: JSON del usuario
```

---

## 🐛 Problemas Comunes

### ❌ Problema 1: MongoDB no está corriendo

**Síntomas:**
```
pymongo.errors.ServerSelectionTimeoutError: localhost:27017: [Errno 111] Connection refused
```

**Solución:**
```bash
docker-compose up -d mongo
docker-compose logs mongo  # Ver logs
```

### ❌ Problema 2: Base de datos vacía

**Síntomas:**
- Endpoint retorna 404
- `count_documents({})` retorna 0

**Solución:**
```bash
python3 scripts/setup_test_users.py
# O:
cd backend && python -m app.cli create-user test test@mail.com
```

### ❌ Problema 3: Usuario existe pero endpoint falla

**Síntomas:**
- MongoDB tiene usuarios
- Endpoint sigue retornando 404

**Posibles causas:**
1. Base de datos incorrecta (revisar MONGO_URI)
2. Colección incorrecta
3. Problema con ObjectId

**Solución:**
```bash
# Verificar que estás usando la base de datos correcta
cd backend
python3 << 'EOF'
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/red_k")
print(f"URI: {MONGO_URI}")

client = MongoClient(MONGO_URI)
print(f"Bases de datos: {client.list_database_names()}")
print(f"Colecciones en red_k: {client.red_k.list_collection_names()}")
print(f"Usuarios en red_k.users: {client.red_k.users.count_documents({})}")
EOF
```

### ❌ Problema 4: Frontend no puede conectar

**Síntomas:**
- Backend funciona (curl exitoso)
- Frontend no puede hacer login

**Solución:**
```bash
# 1. Verificar .env del frontend
cat frontend/.env
# Debe decir: REACT_APP_BACKEND_URL=http://localhost:8001

# 2. Reiniciar frontend
cd frontend
# Ctrl+C
yarn start

# 3. Verificar en browser console (F12)
# Buscar: "API Base URL: http://localhost:8001"
```

---

## 📊 Script de Diagnóstico Automático

Guarda este script como `diagnose.sh`:

```bash
#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO"
echo "======================"

echo -e "\n1️⃣ Docker Services"
docker-compose ps | grep -E "(mongo|redis|neo4j)" || echo "❌ Docker no está corriendo"

echo -e "\n2️⃣ MongoDB Connection"
curl -s http://localhost:27017 > /dev/null && echo "✅ MongoDB responde" || echo "❌ MongoDB no responde"

echo -e "\n3️⃣ Backend Health"
curl -s http://localhost:8001/api/health > /dev/null && echo "✅ Backend responde" || echo "❌ Backend no responde"

echo -e "\n4️⃣ Usuarios en MongoDB"
cd backend
python3 << 'EOF'
from pymongo import MongoClient
try:
    client = MongoClient("mongodb://127.0.0.1:27017/red_k", serverSelectionTimeoutMS=2000)
    count = client.red_k.users.count_documents({})
    if count > 0:
        print(f"✅ {count} usuarios encontrados")
        for user in client.red_k.users.find({}, {"username": 1}).limit(3):
            print(f"   - {user['username']}")
    else:
        print("❌ No hay usuarios")
except Exception as e:
    print(f"❌ Error: {e}")
EOF

echo -e "\n5️⃣ Endpoint de usuarios"
curl -s http://localhost:8001/api/users/ > /dev/null && echo "✅ Endpoint /api/users/ funciona" || echo "❌ Endpoint falla"

echo -e "\n6️⃣ Frontend .env"
if [ -f "frontend/.env" ]; then
    echo "✅ Archivo existe"
    grep "REACT_APP_BACKEND_URL" frontend/.env
else
    echo "❌ Archivo frontend/.env no existe"
fi

echo -e "\n======================"
echo "✅ Diagnóstico completo"
```

**Ejecutar:**
```bash
chmod +x diagnose.sh
./diagnose.sh
```

---

## 🎯 Solución Rápida (TL;DR)

```bash
# 1. Asegurar que MongoDB esté corriendo
docker-compose up -d mongo

# 2. Crear usuarios de prueba
cd backend
source venv/bin/activate
python -m app.cli create-user rodrigo rodrigo@mail.com
python -m app.cli create-user kam kam@mail.com

# 3. Verificar
curl http://localhost:8001/api/users/by-username/rodrigo

# 4. Probar login en http://localhost:3000
```

---

## 📞 Si Nada Funciona

Comparte estos outputs:

```bash
# 1. Estado de Docker
docker-compose ps

# 2. Logs del backend
# (últimas 20 líneas cuando intentas login)

# 3. Usuarios en MongoDB
cd backend && python -m app.cli list-users

# 4. Contenido de .env
cat backend/.env | grep MONGO
cat frontend/.env

# 5. Versión de Python y dependencias
python3 --version
pip list | grep -E "(fastapi|pymongo|uvicorn)"
```

---

**Con estos pasos, el login debería funcionar.** 🎉
