# 🔧 Modos de Ejecución del Backend

Tienes **dos formas** de correr el backend. La configuración del frontend debe coincidir.

---

## 📦 Modo 1: Docker (Recomendado)

### Backend en Docker (Puerto 8000)

**Ventajas:**
- Todo en contenedores
- No necesitas activar venv
- Más parecido a producción
- Incluye CLI en contenedor

**Cómo iniciar:**
```bash
# Desde la raíz del proyecto
docker-compose up -d

# Verificar
docker ps | grep redk_api
# Debe mostrar: 0.0.0.0:8000->8000/tcp
```

**Configuración del frontend:**
```bash
# frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8000
```

**Acceder al CLI:**
```bash
docker exec -it redk_cli bash
python -m app.cli list-users
```

---

## 🔧 Modo 2: uvicorn Manual (Desarrollo)

### Backend con uvicorn (Puerto 8001)

**Ventajas:**
- Hot reload más rápido
- Logs directos en terminal
- Más fácil para debugging
- No necesita Docker

**Cómo iniciar:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Configuración del frontend:**
```bash
# frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Acceder al CLI:**
```bash
cd backend
source venv/bin/activate
python -m app.cli list-users
```

---

## ⚡ Cambio Rápido de Modo

### Usar el Script Automático

```bash
# Desde la raíz del proyecto
chmod +x scripts/switch_mode.sh
./scripts/switch_mode.sh

# Seleccionar opción 1 (Docker) o 2 (uvicorn)
# El script actualiza frontend/.env automáticamente
```

### Cambio Manual

**Para Docker (puerto 8000):**
```bash
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > frontend/.env
```

**Para uvicorn (puerto 8001):**
```bash
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > frontend/.env
```

**Siempre reiniciar frontend después:**
```bash
cd frontend
# Ctrl+C si está corriendo
yarn start
```

---

## 🔍 Verificar Configuración Actual

### 1. Ver puerto del backend
```bash
# Si usas Docker
docker ps | grep redk_api
# Busca: 0.0.0.0:XXXX

# Si usas uvicorn
# Ver en la terminal donde corre
# Busca: "Uvicorn running on http://0.0.0.0:XXXX"
```

### 2. Ver configuración del frontend
```bash
cat frontend/.env
# Debe coincidir con el puerto del backend
```

### 3. Probar conexión
```bash
# Si backend en puerto 8000
curl http://localhost:8000/api/health

# Si backend en puerto 8001
curl http://localhost:8001/api/health

# Debe retornar: {"status":"ok",...}
```

---

## 📊 Tabla Comparativa

| Aspecto | Docker (8000) | uvicorn (8001) |
|---------|---------------|----------------|
| **Inicio** | `docker-compose up -d` | `uvicorn app.main:app --port 8001 --reload` |
| **Logs** | `docker logs redk_api -f` | Directos en terminal |
| **Hot reload** | ✅ Sí | ✅ Sí (más rápido) |
| **CLI** | `docker exec -it redk_cli bash` | `python -m app.cli` |
| **Debugging** | Más complejo | Más fácil |
| **Similar a producción** | ✅ Sí | No |
| **Requiere Docker** | ✅ Sí | No |

---

## 🎯 Recomendación

### Para desarrollo de features:
**Usa uvicorn manual (puerto 8001)**
- Más rápido para iterar
- Logs más claros
- Debugging más fácil

### Para testing completo:
**Usa Docker (puerto 8000)**
- Prueba todo el stack
- Incluye Redis Cluster
- Más parecido a producción

### Para observability dashboard:
**Usa Docker (puerto 8000)**
- Redis Cluster ya configurado
- Todos los servicios corriendo
- Ideal para demo

---

## 🐛 Troubleshooting

### ❌ Login falla con "Network Error"

**Causa:** Puerto incorrecto en frontend/.env

**Solución:**
1. Ver qué puerto usa el backend (ver arriba)
2. Actualizar frontend/.env
3. Reiniciar frontend

### ❌ "Address already in use" al iniciar uvicorn

**Causa:** Puerto 8001 ocupado (probablemente por Docker)

**Solución:**
```bash
# Opción A: Detener Docker
docker-compose down

# Opción B: Usar otro puerto
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
# Y actualizar frontend/.env a puerto 8002
```

### ❌ Observability muestra "No se pudo conectar a Redis Cluster"

**Causa:** Redis Cluster solo está disponible en Docker

**Solución:**
```bash
# 1. Usar modo Docker
docker-compose up -d

# 2. O usar modo mock
# backend/.env
OBSERVABILITY_MODE=mock
```

---

## 📝 Tu Configuración Actual

Basándome en lo que dijiste:

**Backend:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Por lo tanto, tu frontend/.env debe ser:**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Para cambiar:**
```bash
cd /ruta/a/tu/proyecto
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > frontend/.env
cd frontend
yarn start  # Reiniciar
```

---

## ✅ Checklist

Antes de trabajar, verifica:

- [ ] ¿Backend en Docker o uvicorn?
- [ ] ¿En qué puerto corre? (8000 o 8001)
- [ ] ¿frontend/.env coincide con ese puerto?
- [ ] ¿Reinicié el frontend después de cambiar .env?
- [ ] ¿curl al puerto correcto funciona?

---

**Con esto, siempre tendrás la configuración correcta según cómo corras el backend.** 🎯
