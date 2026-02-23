from app.main import create_app


def test_metrics_routes_registered():
    app = create_app()
    metrics_routes = [rule for rule in app.url_map.iter_rules() if "metrics" in rule.rule]
    assert metrics_routes, "No se registraron rutas de métricas"
