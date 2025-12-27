#!/usr/bin/env python3

import sys
import os

# Agregar el directorio app al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.main import create_app

def test_routes():
    app = create_app()
    
    print("Rutas registradas:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.rule} -> {rule.endpoint}")
    
    print("\nVerificando rutas de métricas:")
    metrics_routes = [rule for rule in app.url_map.iter_rules() if 'metrics' in rule.rule]
    for route in metrics_routes:
        print(f"  {route.rule} -> {route.endpoint}")

if __name__ == "__main__":
    test_routes() 