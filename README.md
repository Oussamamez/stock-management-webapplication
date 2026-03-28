# StockFlow

A full-stack inventory management system for small to medium businesses. StockFlow lets you track products, manage orders, handle customers, and generate invoices — all from a clean, modern web interface.

---

## Project Overview

StockFlow provides a complete back-office solution with:

- **Dashboard** — at-a-glance KPIs, revenue charts, and low-stock alerts
- **Inventory** — product catalog with SKU tracking, category grouping, stock levels, and cost/price management
- **Orders** — create and manage customer orders with line items and status tracking
- **Customers** — customer directory with contact details and order history
- **Invoices** — auto-generated PDF invoices linked to orders
- **Authentication** — JWT-based login with protected routes

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Web framework | FastAPI |
| ORM | SQLAlchemy 2 |
| Database | PostgreSQL (via psycopg2) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| PDF generation | ReportLab |
| Server | Uvicorn |

### Frontend
| Layer | Technology |
|---|---|
| Language | TypeScript |
| Framework | React 18 |
| Build tool | Vite 5 |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 |
| HTTP client | Axios |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | React Hot Toast |

---

## System Architecture

```
┌──────────────────────────────────────────────┐
│                   Browser                    │
│         React + TypeScript (port 5000)       │
└────────────────────┬─────────────────────────┘
                     │ HTTP / REST
┌────────────────────▼─────────────────────────┐
│         FastAPI Backend (port 8000)          │
│                                              │
│  /api/auth        JWT login & token issue    │
│  /api/products    Product CRUD               │
│  /api/categories  Category CRUD             │
│  /api/customers   Customer CRUD             │
│  /api/orders      Order CRUD                │
│  /api/invoices    Invoice CRUD + PDF export  │
│  /api/dashboard   Aggregated stats           │
└────────────────────┬─────────────────────────┘
                     │ SQLAlchemy ORM
┌────────────────────▼─────────────────────────┐
│              PostgreSQL Database             │
└──────────────────────────────────────────────┘
```

Both services are started by `start.sh`. The frontend proxies API calls to the backend; in development the backend CORS policy accepts all origins.

### Project Structure

```
/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI app, middleware, router registration
│       ├── models.py        # SQLAlchemy ORM models
│       ├── schemas.py       # Pydantic request/response schemas
│       ├── auth.py          # JWT creation and password hashing
│       ├── config.py        # App settings (reads .env)
│       ├── database.py      # DB engine and session factory
│       └── routers/         # Route handlers (auth, products, categories,
│                            #   customers, orders, invoices, dashboard)
├── frontend/
│   └── src/
│       ├── App.tsx          # Root component and route definitions
│       ├── pages/           # Login, Dashboard, Inventory, Orders,
│       │                    #   Customers, Invoices
│       ├── components/      # Layout shell, Sidebar
│       ├── contexts/        # AuthContext (JWT + user stored in localStorage)
│       └── lib/             # api.ts — Axios instance + TypeScript types
├── seed.py                  # Demo data seeder (runs once on startup)
├── start.sh                 # Starts backend (8000) then frontend (5000)
└── pyproject.toml           # Python dependency manifest
```

---

## Setup & Running

### Prerequisites

- Python 3.11 or later
- Node.js 18 or later and npm
- A running PostgreSQL instance

### 1. Install backend dependencies

```bash
pip install -e .
```

### 2. Install frontend dependencies

```bash
cd frontend && npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root (see [Environment Variables](#environment-variables) below).

### 4. Start the application

```bash
bash start.sh
```

This script will:
1. Start the FastAPI backend on port **8000**
2. Run `seed.py` to populate the database with demo data (only on first run when the database is empty)
3. Start the Vite dev server on port **5000**

Open `http://localhost:5000` in your browser.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | *(none)* | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/stockflow` |
| `SECRET_KEY` | No | `stockflow-super-secret-key-change-in-production-2024` | JWT signing secret — **change this in production** |

These can be set in a `.env` file at the project root or as real environment variables.

---

## Default Credentials

The seed script creates one admin account on first run:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| Email | `admin@stockflow.com` |

> **Note:** Change this password before deploying to a production environment.

---

## API Summary

All endpoints are prefixed with `/api`. After logging in, include the returned JWT token as a Bearer token in the `Authorization` header for all subsequent requests.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Authenticate and receive a JWT token |
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Aggregated business metrics and chart data |
| GET / POST | `/api/products` | List all products / create a product |
| GET / PUT / DELETE | `/api/products/{id}` | Get, update, or delete a product |
| POST | `/api/products/{id}/adjust-stock` | Manually adjust stock quantity |
| GET | `/api/products/{id}/stock-history` | View stock adjustment history |
| GET / POST | `/api/categories` | List all categories / create a category |
| GET / PUT / DELETE | `/api/categories/{id}` | Get, update, or delete a category |
| GET / POST | `/api/customers` | List all customers / create a customer |
| GET / PUT / DELETE | `/api/customers/{id}` | Get, update, or delete a customer |
| GET / POST | `/api/orders` | List all orders / create an order |
| GET / PUT / DELETE | `/api/orders/{id}` | Get, update, or delete an order |
| PUT | `/api/orders/{id}/status` | Update order status (triggers stock deduction on confirm) |
| GET / POST | `/api/invoices` | List all invoices / create an invoice |
| GET | `/api/invoices/{id}` | Get a single invoice |
| PUT | `/api/invoices/{id}/status` | Update invoice status (draft / sent / paid / cancelled) |
| GET | `/api/invoices/{id}/pdf` | Download invoice as a PDF file |

Full interactive API documentation (Swagger UI) is available at `http://localhost:8000/docs` when the backend is running.
