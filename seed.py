"""Seed demo data — runs once on startup if DB is empty."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from backend.app.database import SessionLocal, engine, Base
from backend.app.models import User, Category, Product, Customer
from backend.app.auth import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded, skipping.")
            return

        print("Seeding demo data...")

        # Admin user
        admin = User(
            email="admin@stockflow.com",
            username="admin",
            full_name="Admin User",
            hashed_password=get_password_hash("admin123"),
            is_admin=True,
        )
        db.add(admin)
        db.flush()

        # Categories
        cats = [
            Category(name="Electronics", description="Electronic devices and accessories"),
            Category(name="Clothing", description="Apparel and fashion items"),
            Category(name="Office Supplies", description="Stationery and office essentials"),
            Category(name="Food & Beverage", description="Consumable goods"),
        ]
        for c in cats:
            db.add(c)
        db.flush()

        electronics, clothing, office, food = cats

        # Products
        products = [
            Product(name="Wireless Keyboard", sku="ELEC-001", price=79.99, cost_price=40.00, stock_quantity=45, low_stock_threshold=10, category_id=electronics.id, description="Compact wireless keyboard with long battery life"),
            Product(name="USB-C Hub", sku="ELEC-002", price=49.99, cost_price=22.00, stock_quantity=8, low_stock_threshold=10, category_id=electronics.id),
            Product(name="Bluetooth Headphones", sku="ELEC-003", price=149.99, cost_price=70.00, stock_quantity=0, low_stock_threshold=5, category_id=electronics.id),
            Product(name="Laptop Stand", sku="ELEC-004", price=39.99, cost_price=15.00, stock_quantity=30, low_stock_threshold=8, category_id=electronics.id),
            Product(name="Men's T-Shirt (M)", sku="CLTH-001", price=24.99, cost_price=8.00, stock_quantity=120, low_stock_threshold=20, category_id=clothing.id),
            Product(name="Women's Jeans (32)", sku="CLTH-002", price=59.99, cost_price=25.00, stock_quantity=60, low_stock_threshold=15, category_id=clothing.id),
            Product(name="Running Shoes (10)", sku="CLTH-003", price=89.99, cost_price=45.00, stock_quantity=5, low_stock_threshold=10, category_id=clothing.id),
            Product(name="A4 Paper (500 sheets)", sku="OFF-001", price=12.99, cost_price=5.00, stock_quantity=200, low_stock_threshold=50, category_id=office.id),
            Product(name="Ballpoint Pens (12pk)", sku="OFF-002", price=8.99, cost_price=3.00, stock_quantity=150, low_stock_threshold=30, category_id=office.id),
            Product(name="Sticky Notes (100pk)", sku="OFF-003", price=5.99, cost_price=2.00, stock_quantity=80, low_stock_threshold=20, category_id=office.id),
        ]
        for p in products:
            db.add(p)
        db.flush()

        # Customers
        customers = [
            Customer(name="Acme Corporation", email="orders@acme.com", phone="+1 555-0101", city="New York", country="US", address="123 Business Ave"),
            Customer(name="TechStart Inc.", email="buying@techstart.io", phone="+1 555-0202", city="San Francisco", country="US", address="456 Innovation Dr"),
            Customer(name="Global Retail Ltd", email="procurement@globalretail.co.uk", phone="+44 20 7946 0958", city="London", country="UK", address="789 Commerce St"),
            Customer(name="Maria Garcia", email="maria.garcia@email.com", phone="+1 555-0303", city="Miami", country="US"),
            Customer(name="David Chen", email="d.chen@company.com", phone="+1 555-0404", city="Seattle", country="US"),
        ]
        for c in customers:
            db.add(c)

        db.commit()
        print("✓ Demo data seeded successfully!")
        print("  Login: admin / admin123")

    except Exception as e:
        db.rollback()
        print(f"Seeding error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
