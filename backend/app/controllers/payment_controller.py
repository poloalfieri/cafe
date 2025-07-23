from flask import Blueprint, request, jsonify
from ..services.payment_service import handle_payment_notification

payment_bp = Blueprint("payment", __name__, url_prefix="/payments")

@payment_bp.route("/notify", methods=["POST"])
def payment_notify():
    data = request.json
    handle_payment_notification(data)
    return jsonify({"message": "Notification received"}) 