#!/bin/bash

# Script para verificar el estado del Redis Cluster

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Verificando Redis Cluster..."
echo ""

# Verificar si los contenedores están corriendo
RUNNING=$(docker ps --filter "name=redis-" --format "{{.Names}}" | wc -l)
echo "Contenedores Redis corriendo: $RUNNING/6"

if [ "$RUNNING" -lt 6 ]; then
    echo -e "${RED}❌ No todos los contenedores están corriendo${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todos los contenedores están corriendo${NC}"
echo ""

# Verificar cluster state
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CLUSTER INFO:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO | grep -E "cluster_state|cluster_slots_assigned|cluster_known_nodes|cluster_size"
echo ""

# Mostrar nodos
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CLUSTER NODES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER NODES
echo ""

# Probar inserción
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PRUEBA DE FUNCIONALIDAD:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Insertando clave de prueba..."
docker exec redis-master-1 redis-cli -c -p 7000 SET test_cluster "Hello from cluster!" > /dev/null
RESULT=$(docker exec redis-master-1 redis-cli -c -p 7000 GET test_cluster)
echo "Resultado: $RESULT"

if [ "$RESULT" == "Hello from cluster!" ]; then
    echo -e "${GREEN}✅ Cluster funciona correctamente${NC}"
else
    echo -e "${RED}❌ Error al leer/escribir en el cluster${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DISTRIBUCIÓN DE SLOTS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER SLOTS | head -20
echo ""
