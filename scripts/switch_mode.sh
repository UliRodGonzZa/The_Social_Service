#!/bin/bash
# Script para cambiar entre modo Docker y modo Manual

echo "🔧 Configurador de Modo de Backend"
echo "=================================="
echo ""
echo "¿Cómo quieres correr el backend?"
echo ""
echo "1) Docker (puerto 8000) - Recomendado"
echo "2) Manual uvicorn (puerto 8001)"
echo ""
read -p "Selecciona (1 o 2): " choice

case $choice in
    1)
        echo ""
        echo "📦 Configurando para Docker (puerto 8000)..."
        echo "REACT_APP_BACKEND_URL=http://localhost:8000" > frontend/.env
        echo ""
        echo "✅ Configuración actualizada!"
        echo ""
        echo "📋 Próximos pasos:"
        echo "  1. Iniciar Docker:"
        echo "     docker-compose up -d"
        echo ""
        echo "  2. Reiniciar frontend:"
        echo "     cd frontend"
        echo "     yarn start"
        ;;
    2)
        echo ""
        echo "🔧 Configurando para uvicorn manual (puerto 8001)..."
        echo "REACT_APP_BACKEND_URL=http://localhost:8001" > frontend/.env
        echo ""
        echo "✅ Configuración actualizada!"
        echo ""
        echo "📋 Próximos pasos:"
        echo "  1. Iniciar backend:"
        echo "     cd backend"
        echo "     source venv/bin/activate"
        echo "     uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"
        echo ""
        echo "  2. Reiniciar frontend:"
        echo "     cd frontend"
        echo "     yarn start"
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "📄 Contenido actual de frontend/.env:"
cat frontend/.env
echo ""
