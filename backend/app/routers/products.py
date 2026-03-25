from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ..database import get_db
from ..models import Product, StockAdjustment, User
from ..schemas import ProductCreate, ProductUpdate, ProductOut, StockAdjustmentCreate, StockAdjustmentOut
from ..auth import get_current_user

router = APIRouter()


@router.get("", response_model=List[ProductOut])
def list_products(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    low_stock: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Product).options(joinedload(Product.category))
    if search:
        q = q.filter(
            Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%")
        )
    if category_id:
        q = q.filter(Product.category_id == category_id)
    if low_stock:
        q = q.filter(Product.stock_quantity <= Product.low_stock_threshold)
    return q.order_by(Product.name).all()


@router.post("", response_model=ProductOut)
def create_product(data: ProductCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Product).filter(Product.sku == data.sku).first():
        raise HTTPException(status_code=400, detail="SKU already exists")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return db.query(Product).options(joinedload(Product.category)).filter(Product.id == product.id).first()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    product = db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if data.sku and data.sku != product.sku:
        if db.query(Product).filter(Product.sku == data.sku).first():
            raise HTTPException(status_code=400, detail="SKU already exists")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(product, k, v)
    db.commit()
    db.refresh(product)
    return db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id).first()


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}


@router.post("/{product_id}/adjust-stock", response_model=StockAdjustmentOut)
def adjust_stock(
    product_id: int,
    data: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    new_qty = product.stock_quantity + data.adjustment
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Stock cannot go below zero")
    adj = StockAdjustment(
        product_id=product_id,
        adjustment=data.adjustment,
        previous_quantity=product.stock_quantity,
        new_quantity=new_qty,
        reason=data.reason,
        user_id=current_user.id,
    )
    product.stock_quantity = new_qty
    db.add(adj)
    db.commit()
    db.refresh(adj)
    return adj


@router.get("/{product_id}/stock-history", response_model=List[StockAdjustmentOut])
def stock_history(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(StockAdjustment)
        .filter(StockAdjustment.product_id == product_id)
        .order_by(StockAdjustment.created_at.desc())
        .all()
    )
