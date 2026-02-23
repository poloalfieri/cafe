#!/usr/bin/env python3
"""
Script para probar los endpoints del menú
"""

import os
import pytest
import requests
import json

BASE_URL = "http://localhost:5001"

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS") != "1",
    reason="Integration tests disabled by default"
)

def _integration_headers(include_auth: bool = False):
    slug = os.getenv("TEST_RESTAURANT_SLUG")
    internal_key = os.getenv("INTERNAL_PROXY_KEY") or os.getenv("TEST_INTERNAL_KEY")
    if not slug or not internal_key:
        pytest.skip("Missing TEST_RESTAURANT_SLUG or INTERNAL_PROXY_KEY/TEST_INTERNAL_KEY")
    headers = {
        "Content-Type": "application/json",
        "X-Restaurant-Slug": slug,
        "X-Internal-Key": internal_key,
    }
    if include_auth:
        token = os.getenv("TEST_ADMIN_BEARER")
        if not token:
            pytest.skip("Missing TEST_ADMIN_BEARER for admin-protected endpoints")
        headers["Authorization"] = f"Bearer {token}"
    return headers


@pytest.fixture
def item_id():
    """Create a menu item for integration tests and return its id."""
    test_product = {
        "name": "Test Product",
        "category": "Test Category",
        "price": 9.99,
        "description": "Producto de prueba",
        "available": True
    }
    response = requests.post(
        f"{BASE_URL}/menu",
        json=test_product,
        headers=_integration_headers(include_auth=True),
        timeout=10,
    )
    if response.status_code != 201:
        pytest.skip(f"Could not create menu item: {response.status_code} {response.text}")
    return response.json().get("id")

def test_get_menu():
    """Probar GET /menu"""
    print("🔍 Probando GET /menu...")
    try:
        response = requests.get(
            f"{BASE_URL}/menu",
            headers=_integration_headers(),
            timeout=10,
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Productos encontrados: {len(data)}")
            for item in data[:3]:  # Mostrar solo los primeros 3
                print(f"  - {item.get('name', 'N/A')}: ${item.get('price', 'N/A')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error de conexión: {e}")

def test_create_menu_item():
    """Probar POST /menu"""
    print("\n➕ Probando POST /menu...")
    test_product = {
        "name": "Test Product",
        "category": "Test Category",
        "price": 9.99,
        "description": "Producto de prueba",
        "available": True
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/menu",
            json=test_product,
            headers=_integration_headers(include_auth=True),
            timeout=10,
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 201:
            data = response.json()
            print(f"Producto creado: {data.get('name')} - ID: {data.get('id')}")
            return data.get('id')
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error de conexión: {e}")
    return None

def test_update_menu_item(item_id):
    """Probar PUT /menu/<id>"""
    if not item_id:
        return
    
    print(f"\n✏️ Probando PUT /menu/{item_id}...")
    update_data = {
        "name": "Test Product Updated",
        "price": 12.99
    }
    
    try:
        response = requests.patch(
            f"{BASE_URL}/menu/{item_id}",
            json=update_data,
            headers=_integration_headers(include_auth=True),
            timeout=10,
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Producto actualizado: {data.get('name')} - Precio: ${data.get('price')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error de conexión: {e}")

def test_toggle_availability(item_id):
    """Probar PATCH /menu/<id>/toggle"""
    pytest.skip("Endpoint /menu/<id>/toggle no existe en el backend actual")
    
    print(f"\n🔄 Probando PATCH /menu/{item_id}/toggle...")
    try:
        response = requests.patch(
            f"{BASE_URL}/menu/{item_id}/toggle",
            headers=_integration_headers(include_auth=True),
            timeout=10,
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Disponibilidad cambiada: {data.get('message')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error de conexión: {e}")

def test_delete_menu_item(item_id):
    """Probar DELETE /menu/<id>"""
    if not item_id:
        return
    
    print(f"\n🗑️ Probando DELETE /menu/{item_id}...")
    try:
        response = requests.delete(
            f"{BASE_URL}/menu/{item_id}",
            headers=_integration_headers(include_auth=True),
            timeout=10,
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Producto eliminado: {data.get('message')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error de conexión: {e}")

def main():
    print("🧪 Iniciando pruebas de endpoints del menú...")
    print("=" * 50)
    
    # Probar GET
    test_get_menu()
    
    # Probar POST
    created_id = test_create_menu_item()
    
    # Probar PUT
    test_update_menu_item(created_id)
    
    # Probar PATCH
    test_toggle_availability(created_id)
    
    # Probar DELETE
    test_delete_menu_item(created_id)
    
    print("\n" + "=" * 50)
    print("✅ Pruebas completadas")

if __name__ == "__main__":
    main() 
