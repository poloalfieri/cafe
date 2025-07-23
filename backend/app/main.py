from flask import Flask, jsonify
from .config import Config
from .utils.logger import setup_logger

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    setup_logger()

    @app.errorhandler(Exception)
    def handle_error(e):
        app.logger.error(str(e))
        return jsonify({"error": str(e)}), 500

    from .routes import register_routes
    register_routes(app)
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000) 