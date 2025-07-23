import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    DB_URI = os.getenv("DB_URI", "sqlite:///app.db")
    USE_ORM = os.getenv("USE_ORM", "true").lower() == "true"
    MERCADO_PAGO_TOKEN = os.getenv("MERCADO_PAGO_TOKEN", "")
    KITCHEN_WEBHOOK_URL = os.getenv("KITCHEN_WEBHOOK_URL", "")
    TOKEN_EXPIRY_MINUTES = int(os.getenv("TOKEN_EXPIRY_MINUTES", 10)) 