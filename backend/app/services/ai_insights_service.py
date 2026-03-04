"""
Servicio de consultoría IA para el panel de administración.

Recopila todas las métricas disponibles del restaurante y genera un análisis
en lenguaje natural usando la API de Anthropic (Claude).
El resultado se cachea 3 horas, igual que el resto de las métricas.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .metrics_service import MetricsService
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

_AI_CACHE: Dict[str, Dict[str, Any]] = {}
_AI_CACHE_TTL_SECONDS = 3 * 60 * 60  # 3 horas
_AI_MODEL = "claude-haiku-4-5"
_AI_MAX_TOKENS = 900


def _cache_get(key: str) -> Optional[Any]:
    entry = _AI_CACHE.get(key)
    if not entry:
        return None
    if entry.get("expires_at", 0) <= time.time():
        _AI_CACHE.pop(key, None)
        return None
    return entry.get("value")


def _cache_set(key: str, value: Any) -> None:
    _AI_CACHE[key] = {
        "value": value,
        "expires_at": time.time() + _AI_CACHE_TTL_SECONDS,
    }


def _fmt_currency(value: float) -> str:
    """Formatea un número como moneda argentina sin decimales."""
    try:
        return f"${value:,.0f}".replace(",", ".")
    except Exception:
        return f"${value}"


def _fmt_pct(numerator: float, denominator: float) -> str:
    """Calcula y formatea un porcentaje."""
    if denominator <= 0:
        return "0%"
    return f"{numerator / denominator * 100:.1f}%"


def _build_prompt(
    summary: Dict[str, Any],
    orders_status: Dict[str, Any],
    payment_methods: Dict[str, Any],
    top_products: Dict[str, Any],
    peak_hours: Dict[str, Any],
    daily_revenue: Dict[str, Any],
) -> str:
    """Construye el prompt con todos los datos del negocio."""

    # --- Ventas ---
    daily = summary.get("dailySales", 0)
    weekly = summary.get("weeklySales", 0)
    monthly = summary.get("monthlySales", 0)
    total_orders = summary.get("totalOrders", 0)
    avg_ticket = summary.get("averageOrderValue", 0)
    low_stock = summary.get("lowStockItems", 0)
    total_ingredients = summary.get("totalIngredients", 0)

    # --- Pedidos: aceptados vs cancelados ---
    os_labels = orders_status.get("labels", [])
    os_values = orders_status.get("values", [])
    accepted = 0
    cancelled = 0
    for label, val in zip(os_labels, os_values):
        if "cancel" in label.lower():
            cancelled = val
        else:
            accepted = val
    total_classified = accepted + cancelled
    cancellation_rate = _fmt_pct(cancelled, total_classified)

    # --- Métodos de pago ---
    pm_labels = payment_methods.get("labels", [])
    pm_values = payment_methods.get("values", [])
    pm_total = sum(pm_values) or 1
    pm_lines = []
    for lbl, val in zip(pm_labels, pm_values):
        pct = f"{val / pm_total * 100:.0f}%"
        pm_lines.append(f"  - {lbl}: {val} transacciones ({pct})")
    payment_section = "\n".join(pm_lines) if pm_lines else "  - Sin datos"

    # --- Productos más vendidos ---
    items = top_products.get("items", [])
    prod_lines = []
    for i, item in enumerate(items[:5], 1):
        name = item.get("name", "Desconocido")
        qty = item.get("quantity", 0)
        orders_count = item.get("orders_count", 0)
        prod_lines.append(f"  {i}. {name}: {qty:.0f} unidades en {orders_count} pedidos")
    products_section = "\n".join(prod_lines) if prod_lines else "  - Sin datos"

    # --- Horas punta ---
    ph_labels = peak_hours.get("labels", [])
    ph_values = peak_hours.get("values", [])
    if ph_values and ph_labels:
        sorted_hours = sorted(
            zip(ph_values, ph_labels), reverse=True
        )
        top_hours = [f"{lbl} ({val} pedidos)" for val, lbl in sorted_hours[:3]]
        peak_section = ", ".join(top_hours)
    else:
        peak_section = "Sin datos"

    # --- Ingresos diarios (últimos 7 días) ---
    dr_labels = daily_revenue.get("labels", [])
    dr_values = daily_revenue.get("values", [])
    if dr_values:
        max_day_idx = max(range(len(dr_values)), key=lambda i: dr_values[i])
        min_day_idx = min(range(len(dr_values)), key=lambda i: dr_values[i])
        best_day = f"{dr_labels[max_day_idx]} ({_fmt_currency(dr_values[max_day_idx])})"
        worst_day = f"{dr_labels[min_day_idx]} ({_fmt_currency(dr_values[min_day_idx])})"
        daily_section = f"mejor día: {best_day}, peor día: {worst_day}"
    else:
        daily_section = "Sin datos"

    # --- Stock ---
    stock_line = (
        f"{low_stock} de {total_ingredients} insumos por debajo del stock mínimo"
        if total_ingredients > 0
        else "Sin datos de insumos"
    )

    prompt = f"""Sos un consultor experto en negocios gastronómicos en Argentina, con experiencia en cafés y restaurantes.

Analiza los siguientes datos del negocio y redactá un análisis con exactamente estas tres secciones en formato Markdown:

## Puntos fuertes
(2 o 3 aspectos positivos concretos basados en los datos. Mencioná números específicos.)

## Alertas
(2 o 3 riesgos o situaciones que requieren atención. Sé directo y específico.)

## Recomendaciones para los próximos 30 días
(3 acciones concretas, accionables y específicas. Incluí métricas o referencias numéricas cuando sea útil.)

---

DATOS DEL NEGOCIO (período reciente):

💰 VENTAS:
  - Ventas del día: {_fmt_currency(daily)}
  - Ventas semanales: {_fmt_currency(weekly)}
  - Ventas mensuales: {_fmt_currency(monthly)}
  - Ticket promedio: {_fmt_currency(avg_ticket)}
  - Total pedidos del mes: {total_orders}

📊 PEDIDOS (últimos 30 días):
  - Aceptados: {accepted}
  - Cancelados: {cancelled} (tasa de cancelación: {cancellation_rate})

💳 MÉTODOS DE PAGO (histórico):
{payment_section}

🛒 TOP 5 PRODUCTOS MÁS VENDIDOS (últimos 30 días):
{products_section}

⏰ HORARIOS PUNTA:
  - {peak_section}

📅 INGRESOS DIARIOS (última semana):
  - {daily_section}

⚠️ STOCK DE INSUMOS:
  - {stock_line}

---

Respondé SOLO con el análisis en Markdown. Usá viñetas (guión) para los puntos dentro de cada sección.
Escribí en español rioplatense, de forma directa y profesional. No repitas los datos crudos, interpretá qué significan para el negocio.
"""
    return prompt


class AIInsightsService:
    """Servicio que genera un análisis IA del negocio usando Claude."""

    @staticmethod
    def get_insights(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        tz_offset_minutes: Optional[int] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Retorna un análisis en lenguaje natural basado en las métricas actuales.
        El resultado se cachea 3 horas.

        Raises:
            RuntimeError: si ANTHROPIC_API_KEY no está configurado.
            Exception: si la llamada a la API falla.
        """
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY no está configurado")

        cache_key = f"ai_insights:{restaurant_id}:{branch_id or 'all'}:{tz_offset_minutes or 0}"
        if not force_refresh:
            cached = _cache_get(cache_key)
            if cached is not None:
                logger.info("AI insights: retornando desde caché")
                return cached

        logger.info(f"AI insights: generando análisis para restaurant_id={restaurant_id} branch_id={branch_id}")

        # 1. Recopilar todas las métricas
        try:
            summary = MetricsService.get_dashboard_summary(restaurant_id, branch_id, tz_offset_minutes)
            orders_status = MetricsService.get_orders_status(restaurant_id, branch_id, tz_offset_minutes)
            payment_methods = MetricsService.get_payment_methods(restaurant_id, branch_id, tz_offset_minutes)
            top_products = MetricsService.get_top_products(restaurant_id, branch_id, tz_offset_minutes)
            peak_hours = MetricsService.get_peak_hours(restaurant_id, branch_id, tz_offset_minutes)
            daily_revenue = MetricsService.get_daily_revenue(restaurant_id, branch_id, tz_offset_minutes)
        except Exception as e:
            logger.error(f"AI insights: error al recopilar métricas: {e}")
            raise

        # 2. Construir prompt
        prompt = _build_prompt(
            summary=summary,
            orders_status=orders_status,
            payment_methods=payment_methods,
            top_products=top_products,
            peak_hours=peak_hours,
            daily_revenue=daily_revenue,
        )

        # 3. Llamar a Anthropic
        try:
            import anthropic  # importación lazy para no fallar si no está instalado

            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model=_AI_MODEL,
                max_tokens=_AI_MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
            insights_text = message.content[0].text
            logger.info(f"AI insights: análisis generado ({len(insights_text)} chars)")
        except ImportError:
            raise RuntimeError("El paquete 'anthropic' no está instalado. Ejecutá: pip install anthropic")
        except Exception as e:
            logger.error(f"AI insights: error llamando a Anthropic: {e}")
            raise

        # 4. Construir respuesta y cachear
        result = {
            "insights": insights_text,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": _AI_MODEL,
        }
        _cache_set(cache_key, result)
        return result
