#!/bin/bash

# Script para probar el cache de Redis en tiempo real
# Ejecutar desde el directorio raíz del proyecto

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar si Redis está corriendo
echo -e "${YELLOW}=== VERIFICANDO CONEXIÓN A REDIS ===${NC}"
if docker ps | grep -q redk_redis; then
    REDIS_CMD="docker exec -it redk_redis redis-cli"
    echo -e "${GREEN}✓ Redis de Docker detectado${NC}"
elif redis-cli ping &>/dev/null; then
    REDIS_CMD="redis-cli"
    echo -e "${GREEN}✓ Redis local detectado${NC}"
else
    echo -e "${RED}✗ Redis no está corriendo${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== LIMPIANDO REDIS ===${NC}"
$REDIS_CMD FLUSHDB
echo -e "${GREEN}✓ Redis limpiado${NC}"

echo ""
echo -e "${YELLOW}=== ESTADO INICIAL (debe estar vacío) ===${NC}"
$REDIS_CMD KEYS "*"

echo ""
echo -e "${BLUE}=== CREANDO CACHE DEL FEED ===${NC}"
echo "Haciendo petición a: http://localhost:8001/api/users/rodrigo/feed"
RESPONSE=$(curl -s "http://localhost:8001/api/users/rodrigo/feed?mode=all&limit=20")
echo -e "${GREEN}✓ Petición completada${NC}"

echo ""
echo -e "${YELLOW}=== VERIFICANDO CACHE (INMEDIATAMENTE) ===${NC}"
KEYS=$($REDIS_CMD KEYS "feed:*")
if [ -z "$KEYS" ]; then
    echo -e "${RED}✗ No se encontró cache del feed${NC}"
    echo ""
    echo -e "${YELLOW}Posibles razones:${NC}"
    echo "1. Backend no está conectado a este Redis"
    echo "2. Hay un error en el código que impide guardar el cache"
    echo "3. Redis está configurado con una DB diferente"
    echo ""
    echo -e "${YELLOW}Verificando configuración del backend:${NC}"
    grep REDIS_URL backend/.env || echo "No se encontró REDIS_URL en backend/.env"
else
    echo -e "${GREEN}✓ Cache encontrado:${NC}"
    echo "$KEYS"
    
    echo ""
    echo -e "${BLUE}=== INFORMACIÓN DEL CACHE ===${NC}"
    FEED_KEY=$(echo "$KEYS" | head -1)
    
    echo "Clave: $FEED_KEY"
    echo -n "TTL restante: "
    $REDIS_CMD TTL "$FEED_KEY"
    echo ""
    echo "Contenido (primeros 300 caracteres):"
    $REDIS_CMD GET "$FEED_KEY" | head -c 300
    echo "..."
fi

echo ""
echo ""
echo -e "${BLUE}=== PROBANDO LIKES (más fácil de verificar) ===${NC}"
echo "Los likes NO tienen TTL, así que persisten"

# Obtener un post_id del feed
POST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if data else 'test123')" 2>/dev/null || echo "test123")

echo "Dando like al post: $POST_ID"
curl -s -X POST "http://localhost:8001/api/posts/$POST_ID/like?username=rodrigo" > /dev/null
echo -e "${GREEN}✓ Like dado${NC}"

echo ""
echo "Verificando en Redis:"
echo -n "Contador de likes: "
$REDIS_CMD GET "post:$POST_ID:likes:count"

echo "Usuarios que dieron like:"
$REDIS_CMD SMEMBERS "post:$POST_ID:likes:users"

echo ""
echo "Trending posts:"
$REDIS_CMD ZREVRANGE "trending:posts" 0 4 WITHSCORES

echo ""
echo ""
echo -e "${YELLOW}=== TODAS LAS CLAVES EN REDIS ===${NC}"
$REDIS_CMD KEYS "*"

echo ""
echo ""
echo -e "${BLUE}=== TEST DE EXPIRACIÓN DEL CACHE ===${NC}"
echo "El cache del feed expira en 60 segundos"
echo -n "TTL actual del cache del feed: "
if [ ! -z "$FEED_KEY" ]; then
    TTL=$($REDIS_CMD TTL "$FEED_KEY")
    echo "$TTL segundos"
    
    if [ "$TTL" -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Esperando $TTL segundos para ver la expiración...${NC}"
        echo "(Presiona Ctrl+C para cancelar)"
        sleep $((TTL + 2))
        
        echo ""
        echo "Verificando si el cache expiró:"
        KEYS_AFTER=$($REDIS_CMD KEYS "feed:*")
        if [ -z "$KEYS_AFTER" ]; then
            echo -e "${GREEN}✓ Cache expiró correctamente${NC}"
        else
            echo -e "${RED}✗ Cache sigue presente (no debería)${NC}"
        fi
    fi
else
    echo "No hay cache para verificar expiración"
fi

echo ""
echo ""
echo -e "${GREEN}=== RESUMEN ===${NC}"
echo "Cache del feed: $([ -z "$KEYS" ] && echo -e "${RED}NO creado${NC}" || echo -e "${GREEN}Creado correctamente${NC}")"
echo "Likes funcionando: $([ $($REDIS_CMD EXISTS "post:$POST_ID:likes:count") -eq 1 ] && echo -e "${GREEN}SÍ${NC}" || echo -e "${RED}NO${NC}")"

echo ""
echo -e "${BLUE}Para monitorear Redis en tiempo real, ejecuta en otra terminal:${NC}"
echo "  $REDIS_CMD"
echo "  127.0.0.1:6379> MONITOR"
