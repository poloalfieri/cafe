import requests

def notify_kitchen(order_id):
    # Opción 1: Webhook
    # requests.post(KITCHEN_WEBHOOK_URL, json={"order_id": order_id})

    # Opción 2: Websockets (Flask-SocketIO)
    # from flask_socketio import emit
    # emit("new_order", {"order_id": order_id}, broadcast=True)

    # Opción 3: Guardar en tabla pedidos_para_cocina
    pass  # Implementar según necesidad 