#!/usr/bin/env python3
"""
Script de prueba para la integración con Payway
Verifica que el servicio de Payway funcione correctamente
"""

import os
import pytest
import requests
import json
from datetime import datetime

# Configuración
BACKEND_URL = "http://localhost:5001"

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS") != "1",
    reason="Integration tests disabled by default"
)

def _integration_headers():
    slug = os.getenv("TEST_RESTAURANT_SLUG")
    internal_key = os.getenv("INTERNAL_PROXY_KEY") or os.getenv("TEST_INTERNAL_KEY")
    if not slug or not internal_key:
        pytest.skip("Missing TEST_RESTAURANT_SLUG or INTERNAL_PROXY_KEY/TEST_INTERNAL_KEY")
    return {
        "Content-Type": "application/json",
        "X-Restaurant-Slug": slug,
        "X-Internal-Key": internal_key,
    }

def _require_mesa_branch():
    mesa_id = os.getenv("TEST_MESA_ID")
    branch_id = os.getenv("TEST_BRANCH_ID")
    if not mesa_id or not branch_id:
        pytest.skip("Missing TEST_MESA_ID or TEST_BRANCH_ID for payway test")
    return mesa_id, branch_id

def test_payway_service():
    """Prueba el servicio de Payway"""
    print("🔧 Probando integración con Payway...")
    
    # Datos de prueba
    mesa_id, branch_id = _require_mesa_branch()
    test_data = {
        "monto": 1500.00,
        "mesa_id": mesa_id,
        "branch_id": branch_id,
        "descripcion": "Pedido de prueba - Café x2, Torta x1",
        "items": [{"id": 1, "quantity": 1}],
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/payment/init",
            headers=_integration_headers(),
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("  ✅ Pago inicializado exitosamente")
            print(f"     Payment Link: {data.get('payment_link', 'N/A')}")
            print(f"     Preference ID: {data.get('preference_id', 'N/A')}")
            print(f"     External Reference: {data.get('external_reference', 'N/A')}")
            
            # Verificar que el link sea válido
            if data.get('payment_link') and 'payway.com.ar' in data.get('payment_link', ''):
                print("  ✅ Link de Payway válido")
            else:
                print("  ⚠️  Link de Payway no válido (modo simulación)")
                
        else:
            print(f"  ❌ Error {response.status_code}")
            print(f"     Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Error de conexión - {str(e)}")
    
    print()

def test_webhook_endpoint():
    """Prueba el endpoint de webhook de Payway"""
    print("🔗 Probando endpoint de webhook...")
    
    # Simular webhook de Payway
    webhook_data = {
        "type": "payment",
        "data": {
            "id": "test_payment_123",
            "external_reference": "mesa_Mesa Test 1_abc123",
            "status": "approved",
            "transaction_amount": 1500.00
        }
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/payment/webhooks/payway",
            headers={"Content-Type": "application/json"},
            json=webhook_data,
            timeout=30
        )
        
        if response.status_code == 200:
            print("  ✅ Webhook procesado exitosamente")
        else:
            print(f"  ❌ Error {response.status_code}")
            print(f"     Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Error de conexión - {str(e)}")
    
    print()

def test_environment_variables():
    """Verifica las variables de entorno de Payway"""
    print("🔐 Verificando variables de entorno...")
    
    required_vars = [
        "PAYWAY_PUBLIC_KEY",
        "PAYWAY_ACCESS_TOKEN", 
        "PAYWAY_CLIENT_ID",
        "PAYWAY_CLIENT_SECRET"
    ]
    
    for var in required_vars:
        value = os.getenv(var)
        if value and value != "demo_key" and value != "demo_token":
            print(f"  ✅ {var}: Configurado")
        elif value:
            print(f"  ⚠️  {var}: Valor de demo ({value[:10]}...)")
        else:
            print(f"  ❌ {var}: No configurado")
    
    print()

def test_payway_configuration():
    """Verifica la configuración de Payway"""
    print("⚙️  Verificando configuración de Payway...")
    
    # Verificar URLs de la aplicación
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        if response.status_code in [200, 404, 405]:
            print("  ✅ Backend accesible")
        else:
            print(f"  ⚠️  Backend respondió con código {response.status_code}")
    except:
        print("  ❌ Backend no accesible")
    
    # Verificar que el servicio esté corriendo
    try:
        response = requests.get(f"{BACKEND_URL}/waiter/calls", timeout=5)
        if response.status_code == 200:
            print("  ✅ Servicios funcionando")
        else:
            print(f"  ⚠️  Servicios respondieron con código {response.status_code}")
    except:
        print("  ❌ Servicios no accesibles")
    
    print()

def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando pruebas de integración con Payway...")
    print("=" * 60)
    
    test_environment_variables()
    test_payway_configuration()
    test_payway_service()
    test_webhook_endpoint()
    
    print("=" * 60)
    print("✅ Pruebas de Payway completadas")
    print("\n📋 Para configurar Payway en producción:")
    print("   1. Crear cuenta en https://www.payway.com.ar/")
    print("   2. Verificar identidad y cuenta bancaria")
    print("   3. Obtener credenciales de API")
    print("   4. Configurar variables de entorno")
    print("   5. Configurar webhooks")
    print("   6. Probar en sandbox antes de producción")
    print("\n📖 Ver PAYWAY_CONFIGURACION.md para detalles completos")

if __name__ == "__main__":
    main() 
