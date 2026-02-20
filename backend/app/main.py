from flask import Flask, jsonify, Blueprint
from flask_cors import CORS
from .config import Config
from .utils.logger import setup_logger
from .socketio import socketio

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Configurar CORS de forma segura - SOLO dominios permitidos
    CORS(
        app,
        origins=Config.CORS_ORIGINS,
        methods=Config.CORS_METHODS,
        allow_headers=Config.CORS_ALLOW_HEADERS,
        supports_credentials=Config.CORS_SUPPORTS_CREDENTIALS,
        max_age=3600  # Cache preflight requests por 1 hora
    )

    socketio.init_app(app)
    
    setup_logger(__name__)
    app.logger.info(f"CORS configurado - Origins permitidos: {Config.CORS_ORIGINS}")
    
    # Register multi-tenant middleware
    from .middleware.tenant import tenant_middleware
    app.before_request(tenant_middleware)
    
    # Endpoints básicos
    @app.route("/")
    def index():
        return jsonify({
            "message": "API Café/Restaurante",
            "version": "1.0.0",
            "status": "running",
            "endpoints": {
                "health": "/health",
                "orders": "/orders",
                "payments": "/payment",
                "menu": "/menu",
                "mesas": "/mesas",
                "metrics": "/metrics"
            }
        })
    
    @app.route("/health")
    def health():
        return jsonify({
            "status": "healthy",
            "version": "1.0.0",
            "cors_origins": Config.CORS_ORIGINS
        })

    @app.errorhandler(404)
    def handle_404(e):
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    @app.errorhandler(Exception)
    def handle_error(e):
        # Don't catch 404 errors
        if hasattr(e, 'code') and e.code == 404:
            return jsonify({"error": str(e)}), 404
        app.logger.error(str(e))
        return jsonify({"error": str(e)}), 500

    from .routes import register_routes
    register_routes(app)
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5001)
