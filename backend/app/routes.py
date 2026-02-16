from .controllers.order_controller import orders_bp
from .controllers.payment_controller import payment_bp
from .controllers.menu_controller import menu_bp
from .controllers.waiter_controller import waiter_bp
from .controllers.metrics_controller import metrics_bp
from .controllers.mesa_controller import mesa_bp
from .controllers.branches_controller import branches_bp
from .controllers.promotions_controller import promotions_bp
from .controllers.menu_categories_controller import menu_categories_bp
from .controllers.ingredients_controller import ingredients_bp
from .controllers.recipes_controller import recipes_bp
from .controllers.product_options_controller import product_options_bp

def register_routes(app):
    app.register_blueprint(orders_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(menu_bp)
    app.register_blueprint(waiter_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(mesa_bp)
    app.register_blueprint(branches_bp)
    app.register_blueprint(promotions_bp)
    app.register_blueprint(menu_categories_bp)
    app.register_blueprint(ingredients_bp)
    app.register_blueprint(recipes_bp)
    app.register_blueprint(product_options_bp)
