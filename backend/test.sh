#!/bin/bash
# Script para probar los endpoints del backend

echo "🧪 Probando Backend - Café/Restaurante"
echo "========================================"
echo ""

# Configuración
BASE_URL="http://localhost:5001"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para probar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo "  → $method $BASE_URL$endpoint"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✅ $http_code${NC}"
        echo "  Response: $body" | head -c 150
        echo ""
    else
        echo -e "  ${RED}❌ $http_code${NC}"
        echo "  Response: $body"
    fi
    echo ""
}

# Verificar que el servidor está corriendo
echo "🔍 Verificando servidor..."
curl -s "$BASE_URL/health" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ El servidor no está corriendo en $BASE_URL${NC}"
    echo ""
    echo "Inicia el servidor primero con:"
    echo "  ./start.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Servidor activo${NC}"
echo ""

# ====================================
# Tests de endpoints
# ====================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/health" "Health Check"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Menú"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/menu/items" "Obtener items del menú"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Productos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/products" "Obtener productos"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Mesas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/mesa" "Obtener todas las mesas"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Pedidos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/order" "Listar todos los pedidos"

# Test de creación de pedido (comentado por defecto)
# echo "Crear pedido de prueba..."
# test_endpoint "POST" "/order/create/mesa_1" "Crear pedido" '{
#   "items": [
#     {"product_id": 1, "name": "Café", "quantity": 1, "price": 250}
#   ]
# }'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Configuración CORS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verificando headers CORS..."
cors_test=$(curl -s -I -H "Origin: http://localhost:3000" "$BASE_URL/health")
if echo "$cors_test" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✅ CORS está configurado${NC}"
    echo "$cors_test" | grep "Access-Control"
else
    echo -e "${RED}❌ CORS no está configurado correctamente${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests completados"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Para más información, revisa:"
echo "  📄 Logs del servidor"
echo "  📄 CORS_ARREGLADO.md"
echo ""
