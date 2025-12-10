# 🚀 GUÍA DE SETUP - REDIS CLUSTER

## Paso 1: Levantar Redis Cluster

```bash
# Desde el directorio raíz del proyecto
docker-compose -f docker-compose-cluster.yml up -d

# Esperar a que los nodos se inicialicen (~15 segundos)
# El contenedor redis-cluster-init creará automáticamente el cluster
```

## Paso 2: Verificar el Cluster

```bash
# Verificar que todos los contenedores están corriendo
docker ps | grep redis

# Deberías ver:
# - redis-master-1 (7000)
# - redis-master-2 (7001)
# - redis-master-3 (7002)
# - redis-replica-1 (7003)
# - redis-replica-2 (7004)
# - redis-replica-3 (7005)
```

## Paso 3: Conectar y Probar

```bash
# Conectar a cualquier master (modo cluster con -c)
docker exec -it redis-master-1 redis-cli -c -p 7000

# Verificar estado del cluster
CLUSTER INFO

# Ver nodos y distribución de slots
CLUSTER NODES

# Probar una key con hash tag
SET {user:alice}:feed "test data"
GET {user:alice}:feed

# Ver en qué slot cayó
CLUSTER KEYSLOT {user:alice}:feed

# Salir
exit
```

## Paso 4: Ejecutar Test Suite

```bash
# Instalar dependencias (si no están)
pip install redis[hiredis]

# Ejecutar tests
python3 scripts/test_redis_cluster.py

# Deberías ver:
# ✓ Test 1: Información del Cluster - PASS
# ✓ Test 2: Nodos del Cluster - PASS
# ✓ Test 3: Hash Tags - PASS
# ✓ Test 4: Sistema de Likes - PASS
# ✓ Test 5: Cache de Feeds - PASS
# ✓ Test 6: Trending Posts - PASS
# ✓ Test 7: Performance - PASS
```

## Paso 5: Simular Failover (OPCIONAL)

```bash
# 1. Detener un master
docker stop redis-master-1

# 2. Esperar 15-20 segundos (cluster-node-timeout)

# 3. Verificar que la réplica se promovió
docker exec -it redis-replica-1 redis-cli -c -p 7003 CLUSTER NODES

# Deberías ver que 7003 ahora es master (no más "slave")

# 4. El cluster sigue funcionando
docker exec -it redis-master-2 redis-cli -c -p 7001 SET {test}:key "works!"

# 5. Restaurar el master
docker start redis-master-1

# 6. Verificar que ahora es réplica
docker exec -it redis-master-1 redis-cli -c -p 7000 CLUSTER NODES

# Debería mostrar que 7000 ahora es réplica de 7003
```

## Paso 6: Monitoreo en Tiempo Real

```bash
# Ver info del cluster continuamente
watch -n 1 'docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO'

# Ver memoria de todos los nodos
for port in 7000 7001 7002; do
  echo "=== Master $port ==="
  docker exec redis-master-$((port-7000+1)) redis-cli -p $port INFO memory | grep used_memory_human
done

# Ver estadísticas de comandos
docker exec redis-master-1 redis-cli -p 7000 INFO stats | grep -E "total_commands|instantaneous_ops"
```

## Paso 7: Limpiar (si necesitas empezar de cero)

```bash
# Detener y eliminar todos los contenedores
docker-compose -f docker-compose-cluster.yml down

# Eliminar volúmenes (CUIDADO: borra todos los datos)
docker-compose -f docker-compose-cluster.yml down -v

# Volver a levantar
docker-compose -f docker-compose-cluster.yml up -d
```

## 📊 Comandos Útiles

### Ver Distribución de Keys

```bash
# Conectar a master 1
docker exec -it redis-master-1 redis-cli -c -p 7000

# Ver cuántas keys tiene cada master
INFO keyspace

# Escanear keys (CUIDADO en producción)
SCAN 0 COUNT 100
```

### Ver Uso de Memoria

```bash
# Por nodo
docker exec redis-master-1 redis-cli -p 7000 INFO memory

# Métricas importantes:
# - used_memory_human
# - used_memory_rss_human
# - mem_fragmentation_ratio
# - maxmemory_human
```

### Ver Replicación

```bash
# En un master
docker exec redis-master-1 redis-cli -p 7000 INFO replication

# En una réplica
docker exec redis-replica-1 redis-cli -p 7003 INFO replication

# Deberías ver:
# - role: master o slave
# - connected_slaves: (en master)
# - master_host: (en slave)
# - master_link_status: up
```

## 🔧 Troubleshooting

### Problema: Cluster no se forma

```bash
# Ver logs del inicializador
docker logs redis-cluster-init

# Si falló, recrear manualmente
docker exec -it redis-master-1 redis-cli --cluster create \
  redis-master-1:7000 redis-master-2:7001 redis-master-3:7002 \
  redis-replica-1:7003 redis-replica-2:7004 redis-replica-3:7005 \
  --cluster-replicas 1 --cluster-yes
```

### Problema: CLUSTERDOWN The cluster is down

```bash
# Verificar que todos los nodos están up
docker ps | grep redis

# Verificar conectividad entre nodos
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER NODES

# Si falta algún master, el cluster se cae (no hay mayoría)
# Solución: levantar el master caído
```

### Problema: MOVED errors persistentes

```bash
# El cliente debe manejar MOVED automáticamente
# Verificar que usas RedisCluster, no Redis normal

# Python:
from redis.cluster import RedisCluster  # ✓ Correcto
from redis import Redis                 # ✗ No funciona con cluster
```

### Problema: CROSSSLOT errors

```bash
# Usar hash tags para agrupar keys relacionadas
SET {user:alice}:feed "data"    # ✓ Mismo slot
SET {user:alice}:profile "data" # ✓ Mismo slot

# Sin hash tags
SET user:alice:feed "data"      # ✗ Slot diferente
SET user:alice:profile "data"   # ✗ Slot diferente
```

## 📚 Próximos Pasos

1. **Integrar con Backend**: Actualizar `backend/app/main.py` para usar RedisCluster
2. **Implementar Cache**: Aplicar estrategias de caché documentadas
3. **Monitoreo**: Configurar alertas para `cluster_state`, memoria, etc.
4. **Load Testing**: Probar con carga real (Apache Bench, Locust)
5. **Backup**: Configurar snapshots y AOF rewrite automático

---

**Recursos:**
- [Documentación completa](./REDIS_CLUSTER_ARCHITECTURE.md)
- [Test suite](./scripts/test_redis_cluster.py)
- [Docker Compose](./docker-compose-cluster.yml)
