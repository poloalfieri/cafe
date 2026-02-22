#!/usr/bin/env python3
"""
Script para arrancar el servidor Flask en desarrollo
"""
from app.main import create_app
from app.socketio import socketio

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)
