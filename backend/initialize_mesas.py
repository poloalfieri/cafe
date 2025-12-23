#!/usr/bin/env python3
"""
Script para inicializar las mesas por defecto
"""

import sys
import os

# Agregar el directorio del proyecto al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import create_app
from app.services.mesa_service import mesa_service

def initialize_mesas(count=10):
    """Inicializar mesas por defecto"""
    app = create_app()
    
    with app.app_context():
        try:
            print(f"Inicializando {count} mesas...")
            
            mesas = mesa_service.initialize_default_mesas(count)
            
            print(f"✅ {len(mesas)} mesas inicializadas exitosamente!")
            print("\nMesas creadas:")
            for mesa in mesas:
                status = "activa" if mesa.get('is_active') else "inactiva"
                print(f"  - Mesa {mesa['mesa_id']} ({status})")
                
        except Exception as e:
            print(f"❌ Error al inicializar las mesas: {e}")
            sys.exit(1)

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    initialize_mesas(count)
