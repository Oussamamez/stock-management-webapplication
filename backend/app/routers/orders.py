from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models import Order, OrderItem, OrderStatus, OrderStatusHistory, Product, Customer, User
from ..schemas import OrderCreate, OrderOut, OrderStatusUpdate
from ..auth import get_current_user
import random
import string

router = APIRouter()


def generate_order_number(db: Session) -> str:
    while True:
        num = "ORD-" + "".join(random.choices(string.digits, k=6))
        if not db.query(Order).filter(Order.order_number == num).first():
            return num


def load_order(db: Session, order_id: int) -> Order:
    return (
        db.query(Order)
        .options(
            joinedload(Order.customer),
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.category),
            joinedload(Order.status_history),
        )
        .filter(Order.id == order_id)
        .first()
    )


@router.get("", response_model=List[OrderOut])
def list_orders(
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.status_history),
    )
    if status:
        try:
            q = q.filter(Order.status == OrderStatus(status))
        except ValueError:
            pass
    if customer_id:
        q = q.filter(Order.customer_id == customer_id)
    if search:
        q = q.join(Customer).filter(
            Order.order_number.ilike(f"%{search}%") |
            Customer.name.ilike(f"%{search}%")
        )
    return q.order_by(Order.created_at.desc()).all()


@router.post("", response_model=OrderOut)
def create_order(data: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if not data.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    order = Order(
        order_number=generate_order_number(db),
        customer_id=data.customer_id,
        notes=data.notes,
        status=OrderStatus.pending,
    )
    db.add(order)
    db.flush()

    total = 0.0
    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
        if item_data.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        unit_price = float(product.price)
        total_price = unit_price * item_data.quantity
        total += total_price
        item = OrderItem(
            order_id=order.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            total_price=total_price,
        )
        db.add(item)

    order.total_amount = total

    history = OrderStatusHistory(
        order_id=order.id,
        status=OrderStatus.pending,
        notes="Order created",
        user_id=current_user.id,
    )
    db.add(history)
    db.commit()
    return load_order(db, order.id)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = load_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.product)).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cannot change status of a cancelled order")

    # Stock deduction on confirm
    if data.status == OrderStatus.confirmed and order.status == OrderStatus.pending:
        for item in order.items:
            product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{product.name}' (available: {product.stock_quantity}, required: {item.quantity})",
                )
            product.stock_quantity -= item.quantity
        order.confirmed_at = datetime.utcnow()

    order.status = data.status
    order.updated_at = datetime.utcnow()

    history = OrderStatusHistory(
        order_id=order.id,
        status=data.status,
        notes=data.notes,
        user_id=current_user.id,
    )
    db.add(history)
    db.commit()
    return load_order(db, order_id)


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.pending, OrderStatus.cancelled):
        raise HTTPException(status_code=400, detail="Only pending or cancelled orders can be deleted")
    db.delete(order)
    db.commit()
    return {"message": "Order deleted"}
