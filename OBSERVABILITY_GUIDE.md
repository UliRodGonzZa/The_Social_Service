# 📊 Guía del Dashboard de Observabilidad Redis Cluster

## 🎯 Objetivo

Dashboard para demostrar comprensión de NoSQL (Redis Cluster) mediante observabilidad en tiempo real:
- Topología del cluster
- Estado de nodos
- Distribución de slots
- Métricas de rendimiento

---

## 🚀 Sprint 1: Cluster Health ✅ COMPLETADO

### Funcionalidades Implementadas

**Backend (`/app/backend/app/observability.py`):**
- ✅ Endpoint `/api/observability/cluster/health`
  - Comando: `CLUSTER INFO` - Estado general
  - Comando: `CLUSTER NODES` - Información de nodos
  - Comando: `INFO` (por nodo) - Métricas individuales
  
- ✅ Endpoint `/api/observability/cluster/slots`
  - Comando: `CLUSTER SLOTS` - Distribución de slots
  
- ✅ Endpoint `/api/observability/mode`
  - Retorna modo actual (mock/production)

**Frontend (`/app/frontend/src/pages/ObservabilityPage.jsx`):**
- ✅ Página `/observability` en el navbar
- ✅ Tab "Cluster Health" con:
  - Cards de métricas generales
  - Tabla de nodos con métricas
  - Visualización de distribución de slots
  - Auto-refresh cada 5 segundos

---

## 🔧 Configuración

### Modo MOCK (Emergent / Testing)

En `/app/backend/.env`:
```bash
OBSERVABILITY_MODE=mock
```

**Características:**
- Datos simulados
- No requiere Redis Cluster
- Útil para desarrollo y demo
- ✅ Funciona en Emergent

### Modo PRODUCTION (Local con Docker)

En `/app/backend/.env`:
```bash
OBSERVABILITY_MODE=production
```

**Requisitos:**
- Redis Cluster corriendo (3 masters + 3 replicas)
- Docker Compose configurado
- Nodos accesibles en:
  - `redis-master-1:7000`
  - `redis-master-2:7001`
  - `redis-master-3:7002`

---

## 📖 Comandos Redis Ejecutados

### 1. CLUSTER INFO
```redis
CLUSTER INFO
```
**Retorna:**
- cluster_state: ok/fail
- cluster_size: número de masters
- cluster_known_nodes: total de nodos
- cluster_slots_assigned/ok/pfail/fail: estado de slots

### 2. CLUSTER NODES
```redis
CLUSTER NODES
```
**Retorna (por nodo):**
- node_id: identificador único
- ip:port: dirección del nodo
- flags: master/slave, fail, etc.
- master_id: ID del master (si es replica)
- state: connected/disconnected
- slots: rangos asignados (solo masters)

**Formato de salida:**
```
abc123... 192.168.1.1:7000 master - 0 0 1 connected 0-5460
def456... 192.168.1.2:7003 slave abc123... 0 0 2 connected
```

### 3. INFO (por nodo)
```redis
INFO memory
INFO stats
INFO clients
INFO server
```
**Campos extraídos:**
- `used_memory_human`: Memoria usada (ej: 2.5M)
- `instantaneous_ops_per_sec`: Operaciones por segundo
- `connected_clients`: Clientes conectados
- `uptime_in_seconds`: Tiempo activo

### 4. CLUSTER SLOTS
```redis
CLUSTER SLOTS
```
**Retorna:**
- Rango de slots (start-end)
- Master que maneja el rango
- Replicas del master

**Ejemplo de respuesta:**
```
[[0, 5460, ["192.168.1.1", 7000, "abc123..."], ["192.168.1.2", 7003, "def456..."]]]
```

---

## 🎨 Visualización

### Cards de Métricas
- 🏥 Estado del Cluster (ok/fail)
- 🖥️ Nodos Conocidos (6 total, 3 masters)
- 🎯 Slots Asignados (16384)
- ✅ Slots OK

### Tabla de Nodos
Columnas:
- **Nodo**: IP:port + node_id
- **Role**: Master 👑 / Replica 🔄
- **Estado**: Connected/Disconnected
- **Slots**: Rangos asignados
- **Memoria**: Uso de RAM
- **Ops/sec**: Operaciones por segundo
- **Clientes**: Conexiones activas
- **Uptime**: Tiempo activo

### Distribución de Slots
Visualización de:
- Master con su rango de slots
- Replicas asociadas
- Porcentaje de cobertura

---

## 🧪 Cómo Probar

### En Emergent (Modo MOCK)

1. **Ir a la página:**
   ```
   http://localhost:3000/observability
   ```

2. **Verificar badge:**
   - Debe decir "🟡 MOCK/DEMO"

3. **Explorar:**
   - Ver nodos simulados
   - Revisar distribución de slots
   - Probar auto-refresh

### En Local (Modo PRODUCTION)

1. **Iniciar Redis Cluster:**
   ```bash
   docker-compose up -d redis-master-1 redis-master-2 redis-master-3 redis-replica-1 redis-replica-2 redis-replica-3
   ```

2. **Verificar cluster:**
   ```bash
   docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO
   ```

3. **Configurar modo:**
   ```bash
   # En /app/backend/.env
   OBSERVABILITY_MODE=production
   ```

4. **Reiniciar backend:**
   ```bash
   # Ctrl+C y reiniciar
   uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
   ```

5. **Probar en navegador:**
   - Badge debe decir "🟢 PRODUCTION"
   - Datos deben ser reales de tu cluster

---

## 📊 Próximos Sprints

### Sprint 2: Messaging Metrics (Planificado)

**Métricas a implementar:**
- Mensajes por minuto/segundo
  - Keys: `msg:rate:{timestamp}`
  - Comando: `INCR` + `EXPIRE`
  
- Presencia y Typing
  - Keys: `presence:{userId}`, `typing:{chatId}:{userId}`
  - TTL: 30 segundos (presencia), 3 segundos (typing)
  
- Unread Counters
  - Keys: `unread:{userId}`
  - Comando: `HGETALL`, `HINCRBY`

**Endpoints:**
- `GET /api/observability/messaging/rate`
- `GET /api/observability/messaging/presence`
- `GET /api/observability/messaging/unread`

### Sprint 3: Data Distribution (Planificado)

**Funcionalidad:**
- Dado un `chatId`, calcular:
  - Hash slot (CRC16 % 16384)
  - Master que maneja ese slot
  - Keys relacionadas

**Endpoint:**
- `GET /api/observability/cluster/distribution?chatId=123`

**Visualización:**
- Mapa interactivo chatId → slot → master
- Ejemplos de distribución
- Estadísticas de balance

---

## 🔍 Troubleshooting

### Problema: "Usuario no existe" en DMs (no relacionado con observability)
Ver `CONFIGURACION_ENV.md`

### Problema: Endpoints retornan 404
**Solución:**
```bash
# Verificar que el router está registrado
curl http://localhost:8001/api/observability/mode
```

### Problema: "No se pudo conectar al Redis Cluster" en modo production
**Causas:**
1. Redis Cluster no está corriendo
2. Nombres de host incorrectos
3. Puertos incorrectos

**Solución:**
```bash
# Verificar containers
docker ps | grep redis

# Probar conexión
docker exec redis-master-1 redis-cli -c -p 7000 PING
```

### Problema: Frontend muestra "MOCK" en lugar de "PRODUCTION"
**Solución:**
1. Verificar `/app/backend/.env`: `OBSERVABILITY_MODE=production`
2. Reiniciar backend
3. Refrescar navegador (Ctrl+Shift+R)

---

## 📚 Recursos de Redis Cluster

**Documentación oficial:**
- [Redis Cluster Tutorial](https://redis.io/docs/management/scaling/)
- [CLUSTER Commands](https://redis.io/commands/?group=cluster)
- [Redis Cluster Specification](https://redis.io/docs/reference/cluster-spec/)

**Comandos útiles:**
```bash
# Ver topología
redis-cli -c -p 7000 CLUSTER NODES

# Ver slots
redis-cli -c -p 7000 CLUSTER SLOTS

# Ver info del cluster
redis-cli -c -p 7000 CLUSTER INFO

# Mover un slot
redis-cli -c -p 7000 CLUSTER SETSLOT 123 MIGRATING <dest-node-id>

# Ver keys en un slot
redis-cli -c -p 7000 CLUSTER GETKEYSINSLOT 123 10
```

---

## ✅ Checklist de Comandos (Sprint 0)

### Topología del Cluster
- [x] `CLUSTER INFO` - Estado general
- [x] `CLUSTER NODES` - Lista de nodos
- [x] `CLUSTER SLOTS` - Distribución de slots

### Métricas por Nodo
- [x] `INFO memory` - Uso de memoria
- [x] `INFO stats` - Estadísticas de operaciones
- [x] `INFO clients` - Clientes conectados
- [x] `INFO server` - Información del servidor

### Estado y Salud
- [x] `PING` - Verificar conectividad
- [x] `CLUSTER INFO` - Estado del cluster
- [ ] `CLUSTER KEYSLOT <key>` - Calcular slot de una key (Sprint 3)
- [ ] `CLUSTER COUNTKEYSINSLOT <slot>` - Contar keys en un slot (Sprint 3)

---

## 🎓 Para la Presentación

**Puntos clave a demostrar:**

1. **Arquitectura NoSQL:**
   - 3 masters con sharding (slots 0-16383)
   - 3 replicas para alta disponibilidad
   - Distribución automática de datos

2. **Comandos Redis:**
   - Mostrar comandos ejecutados en tiempo real
   - Explicar CLUSTER INFO, CLUSTER NODES, CLUSTER SLOTS
   - Demostrar parseo y visualización de datos

3. **Observabilidad:**
   - Dashboard en tiempo real
   - Métricas de rendimiento
   - Estado de salud del cluster

4. **Modo Mock vs Production:**
   - Útil para development
   - Transición fácil a production
   - Manejo de errores

5. **Próximos pasos:**
   - Métricas de mensajería (Sprint 2)
   - Distribución de datos (Sprint 3)
   - Monitoring continuo

---

**Implementado en Sprint 1:** Cluster Health Dashboard con topología, nodos y slots ✅
**Próximo:** Sprint 2 - Messaging Metrics 💬
