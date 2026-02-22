#!/bin/bash
# Script para iniciar el backend en modo desarrollo

echo "🚀 Iniciando Backend - Café/Restaurante"
echo "========================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "run.py" ]; then
    echo -e "${RED}❌ Error: Debe ejecutar este script desde el directorio backend/${NC}"
    exit 1
fi

# Verificar que existe .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Advertencia: No existe archivo .env${NC}"
    echo "Copiando desde env.example..."
    cp env.example .env
    echo -e "${GREEN}✅ Archivo .env creado. Por favor, configúralo antes de continuar.${NC}"
    echo ""
    echo "Variables importantes a configurar:"
    echo "  - SECRET_KEY"
    echo "  - MERCADO_PAGO_ACCESS_TOKEN"
    echo "  - MERCADO_PAGO_PUBLIC_KEY"
    echo ""
    exit 1
fi

echo "🐳 Ejecutando backend con Docker Compose"
echo ""

# Verificar Docker
command -v docker >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

# Verificar Docker Compose
docker compose version >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker Compose no está disponible${NC}"
    exit 1
fi

# Build y up (solo reconstruye si hay cambios)
echo "🔧 Construyendo imagen (si es necesario)..."
docker compose build

echo "🚀 Levantando servicios..."
docker compose up
