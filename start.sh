#!/bin/bash
set -e

echo "Starting StockFlow backend..."
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Seed demo data if needed
python seed.py

echo "Starting StockFlow frontend..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "StockFlow is starting on port 5000..."

wait $BACKEND_PID $FRONTEND_PID
