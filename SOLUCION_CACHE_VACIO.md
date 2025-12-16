# Solución: Cache Vacío en Redis

## Diagnóstico de tu problema

Ejecutaste:
```bash
docker exec -it redk_redis redis-cli
127.0.0.1:6379> SCAN 0 MATCH "feed:rodrigo:*" COUNT 100
1) "0"
2) (empty array)
```

**Resultado:** Vacío

## Causa Principal

**El cache solo se crea cuando haces una petición al endpoint del feed**, y tiene estas características:

1. **Se crea bajo demanda:** No existe hasta que alguien pide el feed
2. **TTL de 60 segundos:** Se autodestruye después de 1 minuto
3. **Debes estar en el Redis correcto:** Si tu backend usa Redis local (127.0.0.1) y tú revisas Redis de Docker, no verás nada

## Solución Paso a Paso

### Opción 1: Prueba Rápida (Un comando)

Abre DOS terminales:

**Terminal 1 - Redis CLI:**
```bash
docker exec -it redk_redis redis-cli
# Déjala abierta y esperando
```

**Terminal 2 - Hacer petición:**
```bash
cd ~/Documents/RODRIGO/FI/9noSemestre/NoSql/ProyectoCopia/The_Social_Service

# Hacer petición que CREA el cache
curl "http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20"
```

**Terminal 1 - Verificar INMEDIATAMENTE:**
```bash
# Tienes menos de 60 segundos
127.0.0.1:6379> KEYS feed:*
# Deberías ver: 1) "feed:rodrigo:all:20"

127.0.0.1:6379> GET "feed:rodrigo:all:20"
# Deberías ver el JSON con los posts

127.0.0.1:6379> TTL "feed:rodrigo:all:20"
# Deberías ver un número entre 1 y 60 (segundos restantes)
```

### Opción 2: Script Automático

```bash
cd ~/Documents/RODRIGO/FI/9noSemestre/NoSql/ProyectoCopia/The_Social_Service
./scripts/test_redis_cache.sh
```

Este script:
1. Limpia Redis
2. Hace petición al feed
3. Verifica que se creó el cache
4. Prueba también likes (que no expiran)
5. Muestra todo el contenido de Redis

### Opción 3: Verificar Likes (Más Fácil)

Los likes NO tienen TTL, así que son más fáciles de verificar:

```bash
# 1. Dar like desde el frontend o con curl
curl -X POST "http://localhost:8001/api/posts/ALGÚN_POST_ID/like?username=rodrigo"

# 2. Verificar en Redis (esto NO expira)
docker exec -it redk_redis redis-cli

127.0.0.1:6379> KEYS post:*
# Deberías ver claves como:
# 1) "post:abc123:likes:count"
# 2) "post:abc123:likes:users"
# 3) "trending:posts"

127.0.0.1:6379> GET "post:abc123:likes:count"
# Deberías ver: "1"

127.0.0.1:6379> SMEMBERS "post:abc123:likes:users"
# Deberías ver: 1) "rodrigo"

127.0.0.1:6379> ZREVRANGE "trending:posts" 0 9 WITHSCORES
# Deberías ver posts ordenados por likes
```

## Verificar que Backend usa el Redis Correcto

```bash
# Ver configuración
cat ~/Documents/RODRIGO/FI/9noSemestre/NoSql/ProyectoCopia/The_Social_Service/backend/.env | grep REDIS_URL
```

**Si dice:**
- `redis://127.0.0.1:6379/0` → Usa Redis LOCAL (no Docker)
- `redis://redis:6379/0` → Usa Redis de Docker

**Si usa Redis LOCAL, conéctate así:**
```bash
redis-cli
# NO uses docker exec
```

## Monitorear en Tiempo Real

Para ver TODO lo que pasa en Redis:

```bash
docker exec -it redk_redis redis-cli
127.0.0.1:6379> MONITOR
OK
# Ahora deja esta terminal abierta
```

En OTRA terminal, haz peticiones y verás en tiempo real:
```
1702845678.123 [0 127.0.0.1:54321] "GET" "feed:rodrigo:all:20"
1702845678.124 [0 127.0.0.1:54321] "SETEX" "feed:rodrigo:all:20" "60" "[...]"
```

## Ejemplo Completo de Flujo

```bash
# Terminal 1: Monitor Redis
docker exec -it redk_redis redis-cli
127.0.0.1:6379> MONITOR

# Terminal 2: Hacer peticiones
cd ~/Documents/RODRIGO/FI/9noSemestre/NoSql/ProyectoCopia/The_Social_Service

# Petición 1: Feed (crea cache)
curl "http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20"

# En Terminal 1 verás:
# "GET" "feed:rodrigo:all:20"    ← Busca cache
# "SETEX" "feed:rodrigo:all:20" "60" "[...]"  ← Lo crea con TTL 60s

# Terminal 3: Verificar
docker exec -it redk_redis redis-cli KEYS "feed:*"

# Esperar 61 segundos y volver a verificar
sleep 61
docker exec -it redk_redis redis-cli KEYS "feed:*"
# Resultado: (empty array) ← Se autodestruyó
```

## Si Aún No Funciona

### Debug 1: Ver logs del backend

```bash
# Si usas supervisor
tail -f /var/log/supervisor/backend.out.log

# Si corres uvicorn manualmente
# Ver la terminal donde corre uvicorn
```

Busca líneas como:
```
[MongoDB] Conectado a mongodb://127.0.0.1:27017 / DB=red_k
```

Pero NO deberías ver errores de Redis.

### Debug 2: Probar conexión a Redis desde Python

```bash
cd ~/Documents/RODRIGO/FI/9noSemestre/NoSql/ProyectoCopia/The_Social_Service/backend
source venv/bin/activate

python3 -c "
import redis
import os
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
print(f'Intentando conectar a: {REDIS_URL}')

r = redis.from_url(REDIS_URL)
print('Ping:', r.ping())
print('Keys:', r.keys('*'))
"
```

### Debug 3: Agregar logs temporales

Edita `backend/app/main.py` línea 627:

```python
# ANTES
r.setex(cache_key, 60, json.dumps([p.dict() for p in posts]))

# CAMBIAR A:
print(f"🔍 Guardando cache: {cache_key}")
r.setex(cache_key, 60, json.dumps([p.dict() for p in posts]))
print(f"✅ Cache guardado con éxito")
```

Reinicia el backend y haz una petición. Verás estos prints en los logs.

## Resumen

**El cache está vacío porque:**
1. ✅ Nadie ha hecho petición al feed aún (normal)
2. ✅ Ya expiró (60 segundos)
3. ❌ Posible: Estás en Redis de Docker pero backend usa Redis local

**Solución:**
1. Haz petición al feed: `curl http://localhost:8001/api/users/rodrigo/feed`
2. Verifica INMEDIATAMENTE: `redis-cli KEYS feed:*` (en menos de 60s)
3. O verifica likes que no expiran: `redis-cli KEYS post:*`

**Para tu presentación:**
Usa likes y trending porque son más fáciles de demostrar (no expiran).
