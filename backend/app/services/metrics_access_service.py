from typing import Optional
from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry


class MetricsAccessService:
    @staticmethod
    def get_restaurant_id(user_id: str) -> Optional[str]:
        def _run():
            return (
                supabase.table("restaurant_users")
                .select("restaurant_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
        resp = execute_with_retry(_run)
        membership = (resp.data or [None])[0]
        if not membership:
            return None
        return membership.get("restaurant_id")


metrics_access_service = MetricsAccessService()
