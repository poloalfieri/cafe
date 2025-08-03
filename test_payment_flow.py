#!/usr/bin/env python3
"""
Script de prueba para el flujo de pagos implementado
Verifica que todos los endpoints funcionen correctamente
"""

import requests
import json
import time

# Configuración
BACKEND_URL = "http://localhost:5001"
FRONTEND_URL = "http://localhost:3000"

def test_waiter_notification():
    """Prueba el endpoint de notificación al mozo"""
    print("🔔 Probando notificación al mozo...")
    
    # Probar diferentes motivos
    motivos = ["pago_efectivo", "pago_tarjeta", "pago_qr"]
    
    for motivo in motivos:
        try:
            response = requests.post(
                f"{BACKEND_URL}/waiter/notificar-mozo",
                headers={"Content-Type": "application/json"},
                json={
                    "mesa_id": "Mesa 1",
                    "motivo": motivo,
                    "usuario_id": "cliente_test",
                    "message": f"Prueba de {motivo}"
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                print(f"  ✅ {motivo}: {data['message']}")
                print(f"     ID: {data['notification']['id']}")
            else:
                print(f"  ❌ {motivo}: Error {response.status_code}")
                print(f"     Response: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"  ❌ {motivo}: Error de conexión - {str(e)}")
    
    print()

def test_payment_init():
    """Prueba el endpoint de inicialización de pago"""
    print("💳 Probando inicialización de pago...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/payment/init",
            headers={"Content-Type": "application/json"},
            json={
                "monto": 1500.00,
                "mesa_id": "Mesa 1",
                "descripcion": "Pedido de prueba - Café x2, Torta x1"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Pago inicializado exitosamente")
            print(f"     Payment Link: {data['payment_link']}")
            print(f"     Preference ID: {data['preference_id']}")
            print(f"     External Reference: {data['external_reference']}")
        else:
            print(f"  ❌ Error {response.status_code}")
            print(f"     Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Error de conexión - {str(e)}")
    
    print()

def test_waiter_calls():
    """Prueba el endpoint de llamadas al mozo"""
    print("📞 Probando llamadas al mozo...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/waiter/calls")
        
        if response.status_code == 200:
            data = response.json()
            calls = data.get('calls', [])
            print(f"  ✅ Llamadas obtenidas: {len(calls)}")
            
            for call in calls[:3]:  # Mostrar solo las primeras 3
                print(f"     - Mesa {call['mesa_id']}: {call.get('message', 'Sin mensaje')}")
        else:
            print(f"  ❌ Error {response.status_code}")
            print(f"     Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Error de conexión - {str(e)}")
    
    print()

def test_backend_health():
    """Prueba la salud del backend"""
    print("🏥 Verificando salud del backend...")
    
    try:
        # Intentar conectar al backend
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        
        if response.status_code in [200, 404, 405]:  # Cualquier respuesta indica que el servidor está corriendo
            print("  ✅ Backend está corriendo")
        else:
            print(f"  ⚠️  Backend respondió con código {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("  ❌ No se puede conectar al backend")
        print("     Asegúrate de que el servidor Flask esté corriendo en http://localhost:5001")
    except requests.exceptions.Timeout:
        print("  ❌ Timeout al conectar al backend")
    except Exception as e:
        print(f"  ❌ Error inesperado: {str(e)}")
    
    print()

def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando pruebas del flujo de pagos...")
    print("=" * 50)
    
    # Verificar que el backend esté corriendo
    test_backend_health()
    
    # Si el backend está corriendo, continuar con las pruebas
    try:
        test_waiter_notification()
        test_payment_init()
        test_waiter_calls()
    except Exception as e:
        print(f"❌ Error durante las pruebas: {str(e)}")
    
    print("=" * 50)
    print("✅ Pruebas completadas")
    print("\n📋 Para probar el frontend:")
    print(f"   1. Navega a {FRONTEND_URL}/usuario?mesa_id=1&token=test_token")
    print("   2. Agrega productos al carrito")
    print("   3. Ve al carrito y presiona 'Pagar'")
    print("   4. Prueba cada método de pago en el modal")

if __name__ == "__main__":
    main() 