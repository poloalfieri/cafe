from .controllers.order_controller import order_bp
from .controllers.payment_controller import payment_bp
from .controllers.menu_controller import menu_bp
from .controllers.product_controller import product_bp, products_bp
from .controllers.waiter_controller import waiter_bp
from .controllers.metrics_controller import metrics_bp
from .controllers.mesa_controller import mesa_bp
from .controllers.branches_controller import branches_bp
from .controllers.promotions_controller import promotions_bp

def register_routes(app):
    app.register_blueprint(order_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(menu_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(waiter_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(mesa_bp)
    app.register_blueprint(branches_bp)
    app.register_blueprint(promotions_bp)
