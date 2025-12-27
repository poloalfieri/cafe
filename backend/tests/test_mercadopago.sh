#!/usr/bin/env bash

# Script para probar la integración de MercadoPago

echo "🚀 Probando integración de MercadoPago con Supabase Edge Functions"
echo ""

# Variables
SUPABASE_URL="http://127.0.0.1:54321"
FUNCTIONS_URL="$SUPABASE_URL/functions/v1"

# Función para verificar que Supabase esté corriendo
check_supabase() {
    echo "📋 Verificando estado de Supabase..."
    if curl -f "$SUPABASE_URL/rest/v1/" >/dev/null 2>&1; then
        echo "✅ Supabase está corriendo en $SUPABASE_URL"
        return 0
    else
        echo "❌ Supabase no está corriendo. Ejecuta 'supabase start' primero."
        return 1
    fi
}

# Función para probar la edge function de test
test_function() {
    echo ""
    echo "🧪 Probando función de test..."
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$FUNCTIONS_URL/test-function" \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Función de test funciona correctamente"
        echo "📝 Respuesta: $body"
    else
        echo "❌ Error en función de test (HTTP $http_code)"
        echo "📝 Respuesta: $body"
    fi
}

# Función para probar create-payment-preference
test_payment_preference() {
    echo ""
    echo "💳 Probando create-payment-preference..."
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$FUNCTIONS_URL/create-payment-preference" \
        -H "Content-Type: application/json" \
        -d '{
            "mesa_id": "mesa_test_001",
            "items": [
                {
                    "name": "Café con leche",
                    "price": "200",
                    "quantity": 2
                },
                {
                    "name": "Tostada integral",
                    "price": "150",
                    "quantity": 1
                }
            ],
            "total_amount": 550
        }')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Preferencia de pago creada exitosamente"
        echo "📝 Respuesta: $body"
    else
        echo "❌ Error al crear preferencia de pago (HTTP $http_code)"
        echo "📝 Respuesta: $body"
    fi
}

# Ejecutar pruebas
check_supabase && test_function && test_payment_preference

echo ""
echo "🏁 Pruebas completadas"
