# StockFlow — Inventory & Order Management SaaS

A full-stack SaaS application for managing inventory, orders, customers, and invoices.

## Architecture

### Backend (FastAPI + PostgreSQL)
- **Framework**: FastAPI with SQLAlchemy ORM
- **Database**: PostgreSQL (Replit built-in) via `DATABASE_URL`
- **Auth**: JWT tokens (python-jose) with bcrypt password hashing
- **PDF Generation**: ReportLab for professional invoice PDFs
- **Entry point**: `uvicorn backend.app.main:app` on port 8000

### Frontend (React + Vite)
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom utility classes
- **State/Data**: TanStack Query (React Query) + Axios
- **Charts**: Recharts (revenue bar chart)
- **Icons**: Lucide React
- **Entry point**: Vite dev server on port 5000 (proxies `/api` → port 8000)

### Project Structure
```
/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI app
│       ├── models.py        # SQLAlchemy models
│       ├── schemas.py       # Pydantic schemas
│       ├── auth.py          # JWT + password hashing
│       ├── config.py        # Settings
│       ├── database.py      # DB connection
│       └── routers/         # API route handlers
├── frontend/
│   └── src/
│       ├── App.tsx          # Routes
│       ├── pages/           # Login, Dashboard, Inventory, Orders, Customers, Invoices
│       ├── components/      # Layout, Sidebar
│       ├── contexts/        # AuthContext
│       └── lib/             # api.ts (axios + TypeScript types)
├── seed.py                  # Demo data seeder (runs once on startup)
├── start.sh                 # Starts backend (8000) + frontend (5000)
└── main.py                  # Entry point
```

## Features
- **Authentication**: JWT login/logout, protected routes
- **Inventory**: Products with SKU, categories, stock levels, low-stock alerts, manual stock adjustments
- **Orders**: Create orders (select customer + products), status workflow (pending → confirmed → processing → shipped → delivered/cancelled), automatic stock deduction on confirm
- **Customers**: Full CRUD customer management
- **Invoices**: Generate PDF invoices from confirmed orders (ReportLab), download PDF, status tracking (draft/sent/paid/cancelled)
- **Dashboard**: Stats cards, 30-day revenue chart (Recharts), recent orders table, low-stock alerts

## Running the App
```bash
bash start.sh
```

## Default Login
- **Username**: `admin`
- **Password**: `admin123`

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `SECRET_KEY` — JWT signing key (default provided, change in production)

## API Endpoints
- `POST /api/auth/login` — Login
- `GET/POST /api/products` — Products CRUD
- `GET/POST /api/categories` — Categories CRUD
- `GET/POST /api/customers` — Customers CRUD
- `GET/POST /api/orders` — Orders CRUD
- `PUT /api/orders/{id}/status` — Update order status (with stock deduction on confirm)
- `GET/POST /api/invoices` — Invoices CRUD
- `GET /api/invoices/{id}/pdf` — Download PDF invoice
- `GET /api/dashboard` — Dashboard stats + charts data
