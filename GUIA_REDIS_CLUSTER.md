# 🚀 Guía para Levantar Redis Cluster Localmente

Esta guía te ayudará a levantar el Redis Cluster de 6 nodos (3 masters + 3 replicas) en tu máquina local.

## 📋 Pre-requisitos

1. **Docker y Docker Compose** instalados en tu máquina
   ```bash
   docker --version
   docker-compose --version
   ```

## 🔧 Paso 1: Levantar el Cluster

### En tu máquina local (NO en Emergent):

```bash
# 1. Navega al directorio del proyecto
cd /ruta/a/tu/proyecto/The_Social_Service

# 2. Detén cualquier contenedor previo (si existe)
docker-compose -f docker-compose-cluster.yml down -v

# 3. Levanta el cluster (esto creará 6 nodos Redis + inicializador)
docker-compose -f docker-compose-cluster.yml up -d

# 4. Espera 15-20 segundos para que el cluster se inicialice
sleep 20

# 5. Verifica que todos los contenedores estén corriendo
docker ps | grep redis
```

**Deberías ver 6 contenedores Redis:**
- redis-master-1 (puerto 7000)
- redis-master-2 (puerto 7001)
- redis-master-3 (puerto 7002)
- redis-replica-1 (puerto 7003)
- redis-replica-2 (puerto 7004)
- redis-replica-3 (puerto 7005)

## ✅ Paso 2: Verificar el Cluster

```bash
# Verificar el estado del cluster
docker exec -it redis-master-1 redis-cli -c -p 7000 CLUSTER INFO

# Ver todos los nodos
docker exec -it redis-master-1 redis-cli -c -p 7000 CLUSTER NODES
```

**Salida esperada:**
```
cluster_state:ok
cluster_slots_assigned:16384
cluster_known_nodes:6
cluster_size:3
```

## 🔧 Paso 3: Configurar tu Backend para usar el Cluster

### Opción A: Usar solo para Observabilidad (Recomendado)

Mantén tu Redis simple para la aplicación y usa el cluster solo para el dashboard:

**Edita `backend/.env`:**
```env
# Redis simple para la app (mantener como está)
REDIS_URL=redis://127.0.0.1:6379/0

# Activar modo production para observabilidad
OBSERVABILITY_MODE=production
```

**Edita `backend/app/observability.py` (líneas 29-33):**
```python
REDIS_CLUSTER_NODES = [
    {"host": "localhost", "port": 7000},  # Cambiar "redis-master-1" por "localhost"
    {"host": "localhost", "port": 7001},  # Cambiar "redis-master-2" por "localhost"
    {"host": "localhost", "port": 7002},  # Cambiar "redis-master-3" por "localhost"
]
```

### Opción B: Usar Cluster para toda la aplicación (Avanzado)

**Edita `backend/.env`:**
```env
# Cambiar a cluster (requiere modificar código de la app)
REDIS_CLUSTER_STARTUP_NODES=localhost:7000,localhost:7001,localhost:7002

# Activar modo production
OBSERVABILITY_MODE=production
```

**Nota:** Opción B requiere refactorizar el código de likes/trending/caché para usar RedisCluster en lugar de Redis simple.

## 🚀 Paso 4: Reiniciar tu Backend Local

```bash
# Si estás corriendo el backend manualmente:
cd backend
source venv/bin/activate  # o tu entorno virtual
python -m uvicorn server:app --reload --port 8001

# Si usas docker-compose simple:
docker-compose restart api
```

## 🧪 Paso 5: Probar el Dashboard

1. Abre tu navegador en `http://localhost:3000`
2. Ve a la página `/observability`
3. Deberías ver:
   - **Badge "🔴 Producción"** en lugar de "🔸 Modo Mock"
   - Datos reales del cluster en "Cluster Health"
   - En "Data Distribution", prueba con `chat:alice::bob`

## 🔍 Comandos Útiles

```bash
# Ver logs del cluster
docker-compose -f docker-compose-cluster.yml logs -f redis-master-1

# Conectarse a un nodo
docker exec -it redis-master-1 redis-cli -c -p 7000

# Probar inserción de datos
docker exec -it redis-master-1 redis-cli -c -p 7000 SET test "hello cluster"
docker exec -it redis-master-1 redis-cli -c -p 7000 GET test

# Ver distribución de slots
docker exec -it redis-master-1 redis-cli -c -p 7000 CLUSTER SLOTS

# Detener el cluster
docker-compose -f docker-compose-cluster.yml down

# Detener y eliminar datos
docker-compose -f docker-compose-cluster.yml down -v
```

## ⚠️ Troubleshooting

### Problema: "Could not connect to Redis Cluster"

**Solución:**
```bash
# Verificar que los puertos estén disponibles
netstat -an | grep -E "7000|7001|7002|7003|7004|7005"

# Reiniciar el cluster
docker-compose -f docker-compose-cluster.yml restart
```

### Problema: "cluster_state:fail"

**Solución:**
```bash
# Recrear el cluster desde cero
docker-compose -f docker-compose-cluster.yml down -v
docker-compose -f docker-compose-cluster.yml up -d
sleep 20
docker exec -it redis-master-1 redis-cli -c -p 7000 CLUSTER INFO
```

### Problema: Backend no se conecta al cluster

**Verifica:**
1. Los puertos 7000, 7001, 7002 estén accesibles
2. `OBSERVABILITY_MODE=production` en `.env`
3. Los hosts en `observability.py` sean `localhost` (no `redis-master-X`)

## 📚 Arquitectura del Cluster

```
┌─────────────────────────────────────────────────────────────┐
│                     Redis Cluster                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Master 1 (7000)          Master 2 (7001)    Master 3 (7002) │
│  Slots: 0-5460           Slots: 5461-10922  Slots: 10923-16383│
│      ↓                         ↓                  ↓           │
│  Replica 1 (7003)        Replica 2 (7004)   Replica 3 (7005) │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Resumen

1. ✅ Levantar cluster: `docker-compose -f docker-compose-cluster.yml up -d`
2. ✅ Cambiar `.env`: `OBSERVABILITY_MODE=production`
3. ✅ Actualizar `observability.py`: hosts a `localhost`
4. ✅ Reiniciar backend
5. ✅ Verificar en `/observability`

---

**Nota Importante:** El cluster solo necesita correr en tu máquina local para desarrollo. En Emergent (producción), mantendremos el modo mock o usarás un cluster en la nube.
