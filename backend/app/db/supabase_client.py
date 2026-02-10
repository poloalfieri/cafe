import os
import httpx
from supabase import create_client, Client
from supabase.client import ClientOptions

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL y SUPABASE_KEY deben estar definidos en el entorno")

httpx_client = httpx.Client(
    timeout=httpx.Timeout(10.0, connect=5.0),
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=10, keepalive_expiry=10.0),
)
options = ClientOptions()
options.httpx_client = httpx_client
options.postgrest_client_timeout = 10

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
