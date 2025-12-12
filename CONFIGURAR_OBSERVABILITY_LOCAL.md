# 🔧 Configurar Observability en Local

## ✅ Pre-requisitos

Tu Redis Cluster debe estar corriendo con Docker Compose:
- 3 masters: `redis-master-1:7000`, `redis-master-2:7001`, `redis-master-3:7002`
- 3 replicas: `redis-replica-1:7003`, `redis-replica-2:7004`, `redis-replica-3:7005`

---

## 🚀 Configuración (2 minutos)

### Paso 1: Cambiar a Modo Production

En tu máquina local, edita `/backend/.env`:

```bash
cd backend
nano .env  # o el editor que prefieras
```

Cambia esta línea:
```env
OBSERVABILITY_MODE=production
```

### Paso 2: Verificar Redis Cluster está Corriendo

```bash
# Ver containers
docker ps | grep redis

# Deberías ver 6 containers de Redis corriendo
```

### Paso 3: Verificar Conexión al Cluster

```bash
# Probar conexión a un master
docker exec redis-master-1 redis-cli -c -p 7000 PING
# Esperado: PONG

# Ver info del cluster
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO
```

### Paso 4: Reiniciar Backend

```bash
cd backend
source venv/bin/activate

# Si está corriendo, detenerlo (Ctrl+C)
# Reiniciar:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Deberías ver en los logs:**
```
✅ Router de observability registrado
INFO: Application startup complete
```

### Paso 5: Probar Endpoints

```bash
# 1. Verificar modo
curl http://localhost:8000/api/observability/mode

# Esperado: {"mode": "production", ...}

# 2. Obtener cluster health
curl http://localhost:8000/api/observability/cluster/health | jq .

# Debería retornar datos reales de tu cluster
```

### Paso 6: Probar en Frontend

1. Ir a http://localhost:3000/observability
2. Deberías ver badge: **🟢 PRODUCTION**
3. Los datos deben ser reales de tu cluster

---

## 🎯 Verificación de Datos Reales

### En el Dashboard deberías ver:

**Métricas del Cluster:**
- Estado: "ok"
- Nodos conocidos: 6
- Slots asignados: 16384
- Slots OK: 16384

**Tabla de Nodos:**
Deberías ver tus 6 nodos reales:
- 3 masters con sus rangos de slots
- 3 replicas asociadas
- Métricas reales de memoria, ops/sec, clientes

**Distribución de Slots:**
- Master 1: 0-5460
- Master 2: 5461-10922
- Master 3: 10923-16383

---

## 🐛 Troubleshooting

### ❌ Error: "No se pudo conectar al Redis Cluster"

**Causa:** Los nombres de host no coinciden.

**Solución:** Verificar nombres en docker-compose:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep redis
```

Si tus containers tienen nombres diferentes, edita `/backend/app/observability.py`:
```python
REDIS_CLUSTER_NODES = [
    {"host": "tu-nombre-master-1", "port": 7000},
    {"host": "tu-nombre-master-2", "port": 7001},
    {"host": "tu-nombre-master-3", "port": 7002},
]
```

### ❌ Dashboard muestra "MOCK" en lugar de "PRODUCTION"

**Causa:** Variable de entorno no se cargó.

**Solución:**
```bash
# 1. Verificar .env
cat backend/.env | grep OBSERVABILITY_MODE

# 2. Reiniciar backend
# Ctrl+C y volver a iniciar
```

### ❌ Algunos nodos aparecen como "disconnected"

**Causa:** Normal si algunos nodos están iniciándose.

**Solución:** Esperar unos segundos y refrescar el dashboard.

---

## 📊 Comandos Útiles

### Ver Estado del Cluster
```bash
# Desde el host
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO

# Nodos
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER NODES

# Slots
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER SLOTS
```

### Agregar Datos de Prueba para Observability

```bash
# Conectar a un master
docker exec -it redis-master-1 redis-cli -c -p 7000

# Dentro de redis-cli:
SET user:1000 "John Doe"
SET user:1001 "Jane Smith"
SET chat:abc123:presence "online"
HSET unread:user:1000 chat:xyz789 5

# Salir
exit
```

---

## 🎓 Para la Presentación

**Demuestra que el dashboard lee datos reales:**

1. **Mostrar comandos Redis:**
   ```bash
   docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO
   ```

2. **Mostrar dashboard:**
   - http://localhost:3000/observability
   - Badge dice "🟢 PRODUCTION"

3. **Explicar:**
   - "El dashboard ejecuta CLUSTER INFO, CLUSTER NODES, CLUSTER SLOTS"
   - "Parsea las respuestas y las visualiza en tiempo real"
   - "Muestra métricas de memoria, operaciones, clientes por nodo"

4. **Refrescar datos:**
   - Clic en "🔄 Refrescar"
   - O activar "Auto-refresh (5s)"
   - Los datos se actualizan en tiempo real

---

## ✅ Checklist Final

- [ ] `OBSERVABILITY_MODE=production` en backend/.env
- [ ] Redis Cluster corriendo (6 containers)
- [ ] Backend reiniciado
- [ ] `/api/observability/mode` retorna `"mode": "production"`
- [ ] Dashboard muestra 🟢 PRODUCTION
- [ ] Datos en la tabla coinciden con `CLUSTER NODES`
- [ ] Auto-refresh funciona

---

**¡Listo para demostrar observabilidad de Redis Cluster con datos reales!** 🎉
