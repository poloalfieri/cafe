from .supabase_client import supabase
from typing import List, Dict, Any, Optional

# 1. Obtener todos los pedidos (ordenados por fecha descendente)
def get_all_orders() -> List[Dict[str, Any]]:
    response = supabase.table("orders").select("*").order("created_at", desc=True).execute()
    return response.data or []

# 2. Insertar un nuevo pedido
def insert_order(order_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    response = supabase.table("orders").insert(order_data).execute()
    if response.data:
        return response.data[0]
    return None

# 3. Obtener pedidos filtrando por user_id
def get_orders_by_user(user_id: int) -> List[Dict[str, Any]]:
    response = supabase.table("orders").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return response.data or [] 