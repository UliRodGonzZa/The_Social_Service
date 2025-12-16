#!/bin/bash

# Script para levantar Redis Cluster localmente
# Ejecutar desde el directorio raíz del proyecto

set -e

echo "🚀 Iniciando Redis Cluster..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker no está instalado${NC}"
    echo "Instala Docker desde: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Error: Docker Compose no está instalado${NC}"
    echo "Instala Docker Compose desde: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker y Docker Compose detectados${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose-cluster.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose-cluster.yml no encontrado${NC}"
    echo "Ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

# Detener contenedores previos
echo -e "${YELLOW}🔄 Deteniendo contenedores previos (si existen)...${NC}"
docker-compose -f docker-compose-cluster.yml down -v 2>/dev/null || true
echo ""

# Levantar el cluster
echo -e "${YELLOW}🐳 Levantando Redis Cluster (6 nodos)...${NC}"
docker-compose -f docker-compose-cluster.yml up -d

# Esperar a que se inicialice
echo ""
echo -e "${YELLOW}⏳ Esperando 20 segundos para la inicialización del cluster...${NC}"
for i in {20..1}; do
    echo -ne "\r   $i segundos restantes...  "
    sleep 1
done
echo ""
echo ""

# Verificar que los contenedores estén corriendo
echo -e "${YELLOW}🔍 Verificando contenedores...${NC}"
RUNNING=$(docker ps --filter "name=redis-" --format "{{.Names}}" | wc -l)

if [ "$RUNNING" -lt 6 ]; then
    echo -e "${RED}❌ Error: Solo $RUNNING de 6 contenedores Redis están corriendo${NC}"
    echo "Verifica los logs con: docker-compose -f docker-compose-cluster.yml logs"
    exit 1
fi

echo -e "${GREEN}✅ 6 contenedores Redis están corriendo${NC}"
echo ""

# Verificar el estado del cluster
echo -e "${YELLOW}🔍 Verificando estado del cluster...${NC}"
CLUSTER_STATE=$(docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO | grep "cluster_state" | cut -d: -f2 | tr -d '\r\n')

if [ "$CLUSTER_STATE" == "ok" ]; then
    echo -e "${GREEN}✅ Cluster State: OK${NC}"
else
    echo -e "${RED}❌ Cluster State: $CLUSTER_STATE${NC}"
    echo "El cluster puede necesitar más tiempo. Espera 30 segundos y vuelve a verificar."
fi

# Mostrar información del cluster
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Redis Cluster levantado exitosamente!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Nodos del cluster:"
docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER NODES | grep -E "master|slave" | awk '{print "   - "$2" ("$3") - "$1}' | sed 's/@.*//'
echo ""
echo "🔗 Puertos expuestos:"
echo "   - Masters: 7000, 7001, 7002"
echo "   - Replicas: 7003, 7004, 7005"
echo ""
echo -e "${YELLOW}📝 Próximos pasos:${NC}"
echo ""
echo "1. Actualizar backend/.env:"
echo "   ${GREEN}OBSERVABILITY_MODE=production${NC}"
echo ""
echo "2. Reiniciar tu backend local"
echo ""
echo "3. Abrir http://localhost:3000/observability"
echo "   Deberías ver el badge '🔴 Producción'"
echo ""
echo -e "${YELLOW}💡 Comandos útiles:${NC}"
echo "   Ver logs:    docker-compose -f docker-compose-cluster.yml logs -f"
echo "   Detener:     docker-compose -f docker-compose-cluster.yml down"
echo "   Estado:      docker exec redis-master-1 redis-cli -c -p 7000 CLUSTER INFO"
echo "   Conectar:    docker exec -it redis-master-1 redis-cli -c -p 7000"
echo ""
