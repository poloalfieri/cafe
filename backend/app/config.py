import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # SECRET_KEY debe estar configurado y no puede ser el valor por defecto inseguro
    _secret_key = os.getenv("SECRET_KEY", "dev")
    if _secret_key == "dev" or not _secret_key or _secret_key.strip() == "":
        raise ValueError(
            "SECRET_KEY no está configurado o usa un valor inseguro. "
            "Por favor, configura SECRET_KEY en el archivo .env con un valor seguro. "
            "Puedes generar uno con: python3 -c 'import secrets; print(secrets.token_hex(32))'"
        )
    SECRET_KEY = _secret_key
    DB_URI = os.getenv("DATABASE_URL", "sqlite:///cafe.db")
    USE_ORM = os.getenv("USE_ORM", "true").lower() == "true"
    
    # Mercado Pago Configuration
    # NOTE: These global credentials are used only as a development fallback.
    # In production, credentials come from payment_configs table per restaurant.
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