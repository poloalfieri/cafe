from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, Float, Text, JSON
import enum
from datetime import datetime

Base = declarative_base()

class OrderStatus(enum.Enum):
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PAYMENT_REJECTED = "PAYMENT_REJECTED"
    PAID = "PAID"
    IN_PREPARATION = "IN_PREPARATION"
    READY = "READY"
    DELIVERED = "DELIVERED"

class PaymentStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    AUTHORIZED = "authorized"
    IN_PROCESS = "in_process"
    IN_MEDIATION = "in_mediation"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    CHARGED_BACK = "charged_back"

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    mesa_id = Column(String, nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.PAYMENT_PENDING)
    token = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    items = Column(JSON)  # Almacenar items como JSON
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Campos de pago
    payment_id = Column(String, nullable=True)
    payment_status = Column(Enum(PaymentStatus), nullable=True)
    payment_preference_id = Column(String, nullable=True)
    payment_init_point = Column(String, nullable=True)
    payment_approved_at = Column(DateTime, nullable=True)
    payment_rejected_at = Column(DateTime, nullable=True)
    refund_id = Column(String, nullable=True)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    description = Column(Text)
    available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow) 