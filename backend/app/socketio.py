from flask_socketio import SocketIO
from .config import Config

socketio = SocketIO(
    cors_allowed_origins=Config.CORS_ORIGINS,
    async_mode="eventlet",
)

