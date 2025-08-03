import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    DB_URI = os.getenv("DATABASE_URL", "sqlite:///cafe.db")
    USE_ORM = os.getenv("USE_ORM", "true").lower() == "true"
    
    # Mercado Pago Configuration
    MERCADO_PAGO_ACCESS_TOKEN = os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "")
    MERCADO_PAGO_PUBLIC_KEY = os.getenv("MERCADO_PAGO_PUBLIC_KEY", "")
    MERCADO_PAGO_WEBHOOK_SECRET = os.getenv("MERCADO_PAGO_WEBHOOK_SECRET", "")
    
    # Application URLs
    BASE_URL = os.getenv("BASE_URL", "http://localhost:5001")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")
    
    # Payway Configuration (para billetera virtual)
    PAYWAY_PUBLIC_KEY = os.getenv("PAYWAY_PUBLIC_KEY", "demo_key")
    PAYWAY_ACCESS_TOKEN = os.getenv("PAYWAY_ACCESS_TOKEN", "demo_token")
    PAYWAY_CLIENT_ID = os.getenv("PAYWAY_CLIENT_ID", "demo_client_id")
    PAYWAY_CLIENT_SECRET = os.getenv("PAYWAY_CLIENT_SECRET", "demo_client_secret")
    
    # Other configurations
    KITCHEN_WEBHOOK_URL = os.getenv("KITCHEN_WEBHOOK_URL", "")
    TOKEN_EXPIRY_MINUTES = int(os.getenv("TOKEN_EXPIRY_MINUTES", 10)) 