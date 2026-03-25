from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from .models import OrderStatus, InvoiceStatus


# Auth
class UserCreate(BaseModel):
    email: str
    username: str
    full_name: Optional[str] = None
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


# Category
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Product
class ProductCreate(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    price: float
    cost_price: Optional[float] = None
    stock_quantity: int = 0
    low_stock_threshold: int = 10
    category_id: Optional[int] = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    low_stock_threshold: Optional[int] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None


class StockAdjustmentCreate(BaseModel):
    adjustment: int
    reason: Optional[str] = None


class StockAdjustmentOut(BaseModel):
    id: int
    adjustment: int
    previous_quantity: int
    new_quantity: int
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str
    description: Optional[str] = None
    price: float
    cost_price: Optional[float] = None
    stock_quantity: int
    low_stock_threshold: int
    is_active: bool
    category_id: Optional[int] = None
    category: Optional[CategoryOut] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Customer
class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "US"
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Order Items
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    total_price: float
    product: Optional[ProductOut] = None

    class Config:
        from_attributes = True


# Order Status History
class OrderStatusHistoryOut(BaseModel):
    id: int
    status: OrderStatus
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Order
class OrderCreate(BaseModel):
    customer_id: int
    notes: Optional[str] = None
    items: List[OrderItemCreate]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    notes: Optional[str] = None


class OrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    customer: Optional[CustomerOut] = None
    status: OrderStatus
    notes: Optional[str] = None
    total_amount: float
    items: List[OrderItemOut] = []
    status_history: List[OrderStatusHistoryOut] = []
    created_at: datetime
    updated_at: datetime
    confirmed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Invoice
class InvoiceCreate(BaseModel):
    order_id: int
    tax_rate: float = 10.0
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    order_id: int
    order: Optional[OrderOut] = None
    status: InvoiceStatus
    issued_date: datetime
    due_date: Optional[datetime] = None
    tax_rate: float
    subtotal: float
    tax_amount: float
    total: float
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Dashboard
class DashboardStats(BaseModel):
    total_orders_today: int
    total_orders_month: int
    revenue_today: float
    revenue_month: float
    low_stock_count: int
    outstanding_invoices: int
    recent_orders: List[OrderOut]
    low_stock_products: List[ProductOut]
    daily_revenue: List[dict]
