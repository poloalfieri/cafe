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

# Verificar que existe la base de datos
if [ ! -f "cafe.db" ]; then
    echo -e "${YELLOW}⚠️  Base de datos no encontrada. Creando...${NC}"
    python3 create_tables.py
fi

# Verificar dependencias instaladas
echo "📦 Verificando dependencias..."
python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Flask no está instalado${NC}"
    echo "Instalando dependencias..."
    pip3 install -r requirements.txt
    echo ""
fi

# Verificar configuración CORS
echo "🔒 Verificando configuración de seguridad..."
python3 -c "
from app.config import Config
print(f'✅ CORS Origins: {Config.CORS_ORIGINS}')
print(f'✅ Frontend URL: {Config.FRONTEND_URL}')
print(f'✅ Backend URL: {Config.BASE_URL}')
" 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error cargando configuración${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Todo listo para iniciar el servidor${NC}"
echo ""
echo "Servidor iniciando en:"
echo "  📍 http://localhost:5001"
echo ""
echo "Endpoints disponibles:"
echo "  🏥 Health Check:  http://localhost:5001/health"
echo "  📋 Pedidos:       http://localhost:5001/order"
echo "  💳 Pagos:         http://localhost:5001/payment"
echo "  🍽️  Menú:         http://localhost:5001/menu"
echo "  📊 Métricas:      http://localhost:5001/metrics"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo "========================================"
echo ""

# Iniciar el servidor
python3 run.py
