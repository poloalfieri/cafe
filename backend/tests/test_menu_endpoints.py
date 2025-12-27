#!/usr/bin/env python3
"""
Script para probar los endpoints del menú
"""

import requests
import json

BASE_URL = "http://localhost:5001"

def test_get_menu():
    """Probar GET /menu"""
    print("🔍 Probando GET /menu...")
    try:
        response = requests.get(f"{BASE_URL}/menu/")
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
            f"{BASE_URL}/menu/",
            json=test_product,
            headers={"Content-Type": "application/json"}
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
        response = requests.put(
            f"{BASE_URL}/menu/{item_id}",
            json=update_data,
            headers={"Content-Type": "application/json"}
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
    if not item_id:
        return
    
    print(f"\n🔄 Probando PATCH /menu/{item_id}/toggle...")
    try:
        response = requests.patch(f"{BASE_URL}/menu/{item_id}/toggle")
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
        response = requests.delete(f"{BASE_URL}/menu/{item_id}")
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