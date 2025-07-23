from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Enum, DateTime
import enum

Base = declarative_base()

class OrderStatus(enum.Enum):
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAID = "PAID"

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    mesa_id = Column(String, nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.PAYMENT_PENDING)
    token = Column(String, nullable=False)
    created_at = Column(DateTime)
    # productos y cantidades pueden ir en un JSON o tabla aparte 