#!/bin/bash
set -e

echo "Running post-merge setup for StockFlow..."

# Install Python dependencies
uv sync

# Install frontend npm dependencies
cd frontend && npm install --prefer-offline 2>&1 | tail -3
cd ..

echo "Post-merge setup complete."
