def handle_payment_notification(data):
    # Simulación: buscar pedido, actualizar a PAID, notificar cocina
    order_id = data.get("order_id")
    # Actualizar estado en DB...
    from .kitchen_notifier import notify_kitchen
    notify_kitchen(order_id) 