from .controllers.order_controller import order_bp
from .controllers.payment_controller import payment_bp
from .controllers.menu_controller import menu_bp
from .controllers.product_controller import product_bp

def register_routes(app):
    app.register_blueprint(order_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(menu_bp)
    app.register_blueprint(product_bp) 