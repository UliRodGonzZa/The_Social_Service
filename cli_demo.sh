#!/bin/bash

# ============================================================================
# Red K - Demo CLI Script
# ============================================================================
# Este script demuestra todos los comandos disponibles en el CLI de Red K
# Ejecutar desde: /app
# ============================================================================

echo "🚀 Red K - Demo CLI"
echo "===================="
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir comandos
print_command() {
    echo -e "${BLUE}$ $1${NC}"
}

# Función para imprimir secciones
print_section() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Navegar al directorio backend
cd /app/backend

# ============================================================================
# 1. USUARIOS
# ============================================================================

print_section "1️⃣  COMANDOS DE USUARIOS"

# 1.1 Listar usuarios existentes
print_command "python -m app.cli list-users"
python -m app.cli list-users
echo ""
read -p "Presiona Enter para continuar..."

# 1.2 Crear nuevo usuario
print_command 'python -m app.cli create-user demo demo@redk.com --name "Demo User" --bio "CLI Demo Account"'
python -m app.cli create-user demo demo@redk.com --name "Demo User" --bio "CLI Demo Account"
echo ""
read -p "Presiona Enter para continuar..."

# 1.3 Seguir a otro usuario
print_command "python -m app.cli follow-user demo alice"
python -m app.cli follow-user demo alice
echo ""
read -p "Presiona Enter para continuar..."

# 1.4 Listar a quién sigue
print_command "python -m app.cli list-following demo"
python -m app.cli list-following demo
echo ""
read -p "Presiona Enter para continuar..."

# 1.5 Ver sugerencias
print_command "python -m app.cli suggest-users demo --limit 5"
python -m app.cli suggest-users demo --limit 5
echo ""
read -p "Presiona Enter para continuar..."

# ============================================================================
# 2. POSTS
# ============================================================================

print_section "2️⃣  COMANDOS DE POSTS"

# 2.1 Crear post
print_command 'python -m app.cli create-post demo "Mi primer post desde la CLI! 🎉" --tag "demo" --tag "cli"'
python -m app.cli create-post demo "Mi primer post desde la CLI! 🎉" --tag "demo" --tag "cli"
echo ""
read -p "Presiona Enter para continuar..."

# 2.2 Ver feed (todos los posts)
print_command "python -m app.cli get-feed demo --limit 5 --mode all"
python -m app.cli get-feed demo --limit 5 --mode all
echo ""
read -p "Presiona Enter para continuar..."

# 2.3 Ver solo posts propios
print_command "python -m app.cli get-feed demo --limit 5 --mode self"
python -m app.cli get-feed demo --limit 5 --mode self
echo ""
read -p "Presiona Enter para continuar..."

# ============================================================================
# 3. MENSAJES DIRECTOS
# ============================================================================

print_section "3️⃣  COMANDOS DE MENSAJES DIRECTOS"

# 3.1 Enviar DM
print_command 'python -m app.cli send-dm demo alice "Hola Alice! Gracias por el contenido"'
python -m app.cli send-dm demo alice "Hola Alice! Gracias por el contenido"
echo ""
read -p "Presiona Enter para continuar..."

# 3.2 Leer conversación
print_command "python -m app.cli read-dm demo alice --limit 10"
python -m app.cli read-dm demo alice --limit 10
echo ""
read -p "Presiona Enter para continuar..."

# 3.3 Listar todas las conversaciones
print_command "python -m app.cli list-dm-conversations demo"
python -m app.cli list-dm-conversations demo
echo ""

# ============================================================================
# FINALIZACIÓN
# ============================================================================

print_section "✅ DEMO COMPLETADA"

echo "Todos los comandos funcionan correctamente!"
echo ""
echo "Para ver ayuda de cualquier comando:"
echo "  $ python -m app.cli <comando> --help"
echo ""
echo "Para ver todos los comandos disponibles:"
echo "  $ python -m app.cli --help"
echo ""
echo "Documentación completa: /app/CLI_GUIDE.md"
echo ""
