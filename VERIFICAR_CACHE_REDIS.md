# Guía para Verificar Cache de Redis

## Problema: Cache vacío

El cache del feed está vacío porque:
1. Solo se crea cuando haces una petición al endpoint del feed
2. Expira después de 60 segundos (TTL)
3. Necesitas estar conectado al Redis correcto (Docker vs local)

## Paso 1: Verificar a qué Redis se conecta el backend

```bash
# Ver configuración del backend
grep REDIS_URL /app/backend/.env
# O desde tu copia local:
grep REDIS_URL ~/Documents/RODRIGO/FI/9noSemestre/NoSql/ProyectoCopia/The_Social_Service/backend/.env
```

**Si dice:**
- `redis://127.0.0.1:6379/0` → Backend usa Redis LOCAL
- `redis://redis:6379/0` → Backend usa Redis de DOCKER

## Paso 2: Conectarse al Redis CORRECTO

### Si backend usa Redis LOCAL (127.0.0.1):
```bash
# Conectarse directamente
redis-cli

# O con conexión explícita
redis-cli -h 127.0.0.1 -p 6379
```

### Si backend usa Redis DOCKER (redis):
```bash
# El comando que ya usas está correcto
docker exec -it redk_redis redis-cli
```

## Paso 3: Crear el cache haciendo una petición

Abre OTRA terminal (mantén redis-cli abierto) y ejecuta:

```bash
# Hacer petición al feed (esto CREA el cache)
curl -s "http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20"

# O con el usuario kam
curl -s "http://localhost:8001/api/users/kam/feed?mode=all&limit=20"
```

## Paso 4: Verificar INMEDIATAMENTE en redis-cli

En la terminal de redis-cli (tiene que ser RÁPIDO, antes de que expire):

```bash
# Ver TODAS las claves
127.0.0.1:6379> KEYS *

# Buscar específicamente feeds
127.0.0.1:6379> KEYS feed:*

# Ver el contenido de una clave
127.0.0.1:6379> GET "feed:rodrigo:all:20"

# Ver cuánto tiempo queda antes de que expire
127.0.0.1:6379> TTL "feed:rodrigo:all:20"
# Resultado: número entre 1 y 60 (segundos restantes)
```

## Paso 5: Ver TODOS los tipos de datos en Redis

### Contadores de Likes
```bash
127.0.0.1:6379> KEYS post:*:likes:count
127.0.0.1:6379> GET "post:abc123:likes:count"
```

### Sets de usuarios que dieron like
```bash
127.0.0.1:6379> KEYS post:*:likes:users
127.0.0.1:6379> SMEMBERS "post:abc123:likes:users"
```

### Trending posts
```bash
127.0.0.1:6379> ZREVRANGE "trending:posts" 0 9 WITHSCORES
```

## Script Completo de Prueba

Copia y pega esto en tu terminal (fuera de redis-cli):

```bash
#!/bin/bash

echo "=== 1. Conectando a Redis y limpiando ==="
redis-cli FLUSHDB

echo ""
echo "=== 2. Haciendo petición al feed ==="
curl -s "http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20" > /dev/null
echo "✓ Petición realizada"

echo ""
echo "=== 3. Verificando cache (INMEDIATAMENTE) ==="
redis-cli KEYS "feed:*"

echo ""
echo "=== 4. Viendo contenido del cache ==="
FEED_KEY=$(redis-cli KEYS "feed:rodrigo:*" | head -1)
if [ ! -z "$FEED_KEY" ]; then
    echo "Clave encontrada: $FEED_KEY"
    echo "TTL restante:"
    redis-cli TTL "$FEED_KEY"
    echo "Contenido (primeros 200 caracteres):"
    redis-cli GET "$FEED_KEY" | head -c 200
    echo "..."
else
    echo "❌ No se encontró cache"
fi

echo ""
echo ""
echo "=== 5. Verificando TODAS las claves en Redis ==="
redis-cli KEYS "*"

echo ""
echo "=== 6. Esperando 61 segundos para ver expiración ==="
echo "Esperando..."
sleep 61

echo ""
echo "=== 7. Verificando que el cache expiró ==="
redis-cli KEYS "feed:*"
echo "(Debería estar vacío)"
```

## Monitoreo en Tiempo Real

Para ver TODAS las operaciones que llegan a Redis:

```bash
# En redis-cli
127.0.0.1:6379> MONITOR
OK
# Ahora verás cada comando que el backend ejecuta en Redis en tiempo real
```

Luego en otra terminal, haz peticiones y verás:
```
1702845678.123 [0 127.0.0.1:54321] "GET" "feed:rodrigo:all:20"
1702845678.124 [0 127.0.0.1:54321] "SETEX" "feed:rodrigo:all:20" "60" "[{...}]"
```

## Verificar que el código está guardando el cache

Revisa el código en `/app/backend/app/main.py` línea 627:

```python
# Línea 627 - Esta línea CREA el cache
r.setex(cache_key, 60, json.dumps([p.dict() for p in posts]))
```

Si esta línea no se ejecuta, el cache no se crea. Posibles razones:
1. Variable `r` es None (Redis no conectó)
2. Hay una excepción en el try/except que se está ignorando
3. El código nunca llega a esta línea

## Debug adicional

Agregar logs temporales en `main.py`:

```python
# Antes de la línea 627
print(f"🔍 DEBUG: Intentando guardar cache con clave: {cache_key}")
print(f"🔍 DEBUG: Redis client: {r}")
print(f"🔍 DEBUG: Número de posts: {len(posts)}")

# Después de la línea 627
print(f"✅ DEBUG: Cache guardado exitosamente")
```

Luego ver los logs del backend:
```bash
tail -f /var/log/supervisor/backend.out.log
# O en tu local:
# Ver la salida de uvicorn en la terminal donde corre
```

## Resumen de Comandos Rápidos

```bash
# 1. Limpiar Redis
redis-cli FLUSHDB

# 2. Crear cache
curl "http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20"

# 3. Ver INMEDIATAMENTE (antes de 60s)
redis-cli KEYS "*"
redis-cli GET "feed:rodrigo:all:20"
redis-cli TTL "feed:rodrigo:all:20"

# 4. Ver en tiempo real
redis-cli MONITOR
```

## Verificación de Likes (Más Persistentes)

Los likes no tienen TTL, así que persisten:

```bash
# 1. Dar like a un post
curl -X POST "http://localhost:8001/api/posts/POST_ID/like?username=rodrigo"

# 2. Ver en Redis (no expira)
redis-cli GET "post:POST_ID:likes:count"
redis-cli SMEMBERS "post:POST_ID:likes:users"
redis-cli ZREVRANGE "trending:posts" 0 -1 WITHSCORES
```

Estas claves NO expiran y son más fáciles de verificar.
