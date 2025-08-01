from datetime import datetime, timedelta
import random
from typing import Dict, List, Any
from ..db.connection import get_db
from ..db.models import Order, OrderStatus, PaymentStatus

class MetricsService:
    @staticmethod
    def get_sales_monthly() -> Dict[str, List]:
        """Obtiene las ventas mensuales del último año"""
        try:
            # En producción, esto consultaría la base de datos real
            # Por ahora simulamos datos
            months = [
                "Ene", "Feb", "Mar", "Abr", "May", "Jun",
                "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
            ]
            
            # Simular ventas mensuales con tendencia creciente
            values = []
            base_sales = 15000
            for i in range(12):
                # Añadir variación estacional y tendencia
                seasonal_factor = 1 + 0.3 * abs(6 - i) / 6  # Más ventas en verano
                trend_factor = 1 + (i * 0.05)  # Tendencia creciente
                random_factor = 0.8 + (random.random() * 0.4)  # Variación aleatoria
                
                monthly_sales = base_sales * seasonal_factor * trend_factor * random_factor
                values.append(round(monthly_sales, 2))
            
            return {
                "labels": months,
                "values": values
            }
        except Exception as e:
            print(f"Error getting monthly sales: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_orders_status() -> Dict[str, List]:
        """Obtiene el conteo de pedidos por estado"""
        try:
            # En producción, esto consultaría la base de datos real
            # Por ahora simulamos datos
            accepted_orders = random.randint(120, 180)
            rejected_orders = random.randint(20, 40)
            
            return {
                "labels": ["Aceptados", "Rechazados"],
                "values": [accepted_orders, rejected_orders]
            }
        except Exception as e:
            print(f"Error getting orders status: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_daily_revenue() -> Dict[str, List]:
        """Obtiene los ingresos diarios de la última semana"""
        try:
            # Generar datos para los últimos 7 días
            days = []
            values = []
            
            for i in range(7):
                date = datetime.now() - timedelta(days=6-i)
                day_name = date.strftime("%a")  # Lun, Mar, Mié, etc.
                days.append(day_name)
                
                # Simular ingresos diarios con variación
                base_revenue = 800
                weekend_factor = 1.3 if day_name in ["Sáb", "Dom"] else 1.0
                random_factor = 0.7 + (random.random() * 0.6)
                
                daily_revenue = base_revenue * weekend_factor * random_factor
                values.append(round(daily_revenue, 2))
            
            return {
                "labels": days,
                "values": values
            }
        except Exception as e:
            print(f"Error getting daily revenue: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_payment_methods() -> Dict[str, List]:
        """Obtiene el uso de métodos de pago"""
        try:
            # En producción, esto consultaría la base de datos real
            # Por ahora simulamos datos
            payment_methods = ["Tarjeta", "Efectivo", "Transferencia"]
            
            # Simular distribución de métodos de pago
            card_payments = random.randint(60, 80)
            cash_payments = random.randint(20, 35)
            transfer_payments = random.randint(5, 15)
            
            values = [card_payments, cash_payments, transfer_payments]
            
            return {
                "labels": payment_methods,
                "values": values
            }
        except Exception as e:
            print(f"Error getting payment methods: {e}")
            return {"labels": [], "values": []} 