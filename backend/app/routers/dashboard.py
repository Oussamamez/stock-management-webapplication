from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta
from ..database import get_db
from ..models import Order, OrderStatus, OrderItem, Invoice, InvoiceStatus, Product
from ..schemas import DashboardStats, OrderOut, ProductOut
from ..auth import get_current_user

router = APIRouter()


@router.get("", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_orders_today = db.query(Order).filter(Order.created_at >= today_start).count()
    total_orders_month = db.query(Order).filter(Order.created_at >= month_start).count()

    revenue_today = db.query(func.sum(Order.total_amount)).filter(
        Order.created_at >= today_start,
        Order.status.notin_([OrderStatus.cancelled])
    ).scalar() or 0

    revenue_month = db.query(func.sum(Order.total_amount)).filter(
        Order.created_at >= month_start,
        Order.status.notin_([OrderStatus.cancelled])
    ).scalar() or 0

    low_stock_count = db.query(Product).filter(
        Product.stock_quantity <= Product.low_stock_threshold,
        Product.is_active == True
    ).count()

    outstanding_invoices = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.draft, InvoiceStatus.sent])
    ).count()

    recent_orders = (
        db.query(Order)
        .options(
            joinedload(Order.customer),
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
        )
        .order_by(Order.created_at.desc())
        .limit(10)
        .all()
    )

    low_stock_products = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.stock_quantity <= Product.low_stock_threshold, Product.is_active == True)
        .order_by(Product.stock_quantity.asc())
        .limit(10)
        .all()
    )

    # Daily revenue for last 30 days
    daily_revenue = []
    for i in range(29, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        rev = db.query(func.sum(Order.total_amount)).filter(
            Order.created_at >= day_start,
            Order.created_at < day_end,
            Order.status.notin_([OrderStatus.cancelled]),
        ).scalar() or 0
        orders_count = db.query(func.count(Order.id)).filter(
            Order.created_at >= day_start,
            Order.created_at < day_end,
        ).scalar() or 0
        daily_revenue.append({
            "date": day.strftime("%b %d"),
            "revenue": float(rev),
            "orders": orders_count,
        })

    return DashboardStats(
        total_orders_today=total_orders_today,
        total_orders_month=total_orders_month,
        revenue_today=float(revenue_today),
        revenue_month=float(revenue_month),
        low_stock_count=low_stock_count,
        outstanding_invoices=outstanding_invoices,
        recent_orders=recent_orders,
        low_stock_products=low_stock_products,
        daily_revenue=daily_revenue,
    )
