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
    
    # CORS Configuration - SEGURIDAD MEJORADA
    # En producción, especificar dominios exactos separados por coma
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
    CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    CORS_ALLOW_HEADERS = ["Content-Type", "Authorization"]
    CORS_SUPPORTS_CREDENTIALS = True
    
    # Other configurations
    KITCHEN_WEBHOOK_URL = os.getenv("KITCHEN_WEBHOOK_URL", "")
    TOKEN_EXPIRY_MINUTES = int(os.getenv("TOKEN_EXPIRY_MINUTES", 10)) 