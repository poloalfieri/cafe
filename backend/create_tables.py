#!/usr/bin/env python3
"""
Script para crear las tablas en la base de datos
"""

import sys
import os

# Agregar el directorio del proyecto al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from app.db.models import Base

def create_tables():
    """Crear todas las tablas definidas en los modelos"""
    try:
        # Configuración de la base de datos
        # Por ahora usaremos SQLite para pruebas
        db_uri = "sqlite:///cafe.db"
        
        print("Creando tablas en la base de datos...")
        print(f"URI de la base de datos: {db_uri}")
        
        engine = create_engine(db_uri)
        Base.metadata.create_all(engine)
        
        print("✅ Tablas creadas exitosamente!")
        print("\nTablas creadas:")
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}")
            
    except Exception as e:
        print(f"❌ Error al crear las tablas: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_tables() 