#!/usr/bin/env python3
"""
Script de prueba para la implementación completa de Mercado Pago Checkout Pro
"""

import os
import pytest
import requests
import json
import time
from datetime import datetime

# Configuración
BACKEND_URL = "http://localhost:5001"
FRONTEND_URL = "http://localhost:3000"

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


@pytest.fixture
def order_id():
    pref_id, order_id = test_create_preference()
    if not order_id:
        pytest.skip("Could not create MercadoPago order in integration test")
    return order_id

def test_create_preference():
    """Probar la creación de una preferencia de pago"""
    print("🧪 Probando creación de preferencia de pago...")
    
    # Datos de prueba
    test_data = {
        "total_amount": 2100,
        "items": [
            {
                "name": "Café Americano",
                "quantity": 1,
                "price": 500
            },
            {
                "name": "Torta de Chocolate",
                "quantity": 2,
                "price": 800
            }
        ],
        "mesa_id": "1"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/payment/create-preference",
            headers=_integration_headers(),
            json=test_data,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Preferencia creada exitosamente")
                return data.get("preference_id"), data.get("order_id")
            else:
                print("❌ Error en la creación de preferencia")
                return None, None
        else:
            print(f"❌ Error HTTP: {response.status_code}")
            return None, None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error de conexión: {e}")
        return None, None

def test_order_status(order_id):
    """Probar la consulta del estado de un pedido"""
    print(f"\n🧪 Probando consulta de estado del pedido {order_id}...")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/payment/order-status/{order_id}",
            headers=_integration_headers(),
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✅ Estado del pedido consultado exitosamente")
            return True
        else:
            print(f"❌ Error HTTP: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error de conexión: {e}")
        return False

def test_frontend_api():
    """Probar la API del frontend"""
    print("\n🧪 Probando API del frontend...")
    
    test_data = {
        "total_amount": 1500,
        "items": [
            {
                "name": "Cappuccino",
                "quantity": 1,
                "price": 750
            },
            {
                "name": "Croissant",
                "quantity": 1,
                "price": 750
            }
        ],
        "mesa_id": "2"
    }
    
    try:
        response = requests.post(
            f"{FRONTEND_URL}/api/payment/create-preference",
            headers={"Content-Type": "application/json"},
            json=test_data,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✅ API del frontend funcionando correctamente")
            return True
        else:
            print(f"❌ Error HTTP: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error de conexión: {e}")
        return False

def test_backend_health():
    """Probar la salud del backend"""
    print("\n🧪 Probando salud del backend...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Backend funcionando correctamente")
            return True
        else:
            print(f"❌ Backend no responde correctamente: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend no disponible: {e}")
        return False

def test_frontend_health():
    """Probar la salud del frontend"""
    print("\n🧪 Probando salud del frontend...")
    
    try:
        response = requests.get(f"{FRONTEND_URL}/", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Frontend funcionando correctamente")
            return True
        else:
            print(f"❌ Frontend no responde correctamente: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Frontend no disponible: {e}")
        return False

def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando pruebas de Mercado Pago Checkout Pro")
    print("=" * 50)
    
    # Verificar que los servicios estén corriendo
    backend_ok = test_backend_health()
    frontend_ok = test_frontend_health()
    
    if not backend_ok:
        print("\n❌ El backend no está disponible. Asegúrate de que esté corriendo en http://localhost:5001")
        return
    
    if not frontend_ok:
        print("\n⚠️  El frontend no está disponible. Algunas pruebas pueden fallar.")
    
    # Probar creación de preferencia
    preference_id, order_id = test_create_preference()
    
    if preference_id and order_id:
        # Probar consulta de estado
        test_order_status(order_id)
    
    # Probar API del frontend
    if frontend_ok:
        test_frontend_api()
    
    print("\n" + "=" * 50)
    print("📋 Resumen de pruebas:")
    print(f"Backend: {'✅ OK' if backend_ok else '❌ ERROR'}")
    print(f"Frontend: {'✅ OK' if frontend_ok else '❌ ERROR'}")
    print(f"Preferencia creada: {'✅ OK' if preference_id else '❌ ERROR'}")
    
    if preference_id:
        print(f"\n🔗 Para probar el checkout completo:")
        print(f"1. Ve a: {FRONTEND_URL}/test-checkout")
        print(f"2. Usa la preferencia ID: {preference_id}")
        print(f"3. Usa las tarjetas de prueba de Mercado Pago")
    
    print("\n🎉 Pruebas completadas!")

if __name__ == "__main__":
    main() 
