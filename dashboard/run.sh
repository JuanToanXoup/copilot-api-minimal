#!/bin/bash

# Multi-Agent Dashboard Launcher
# Starts both the Python backend and React frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Multi-Agent Dashboard ==="
echo ""

# Check dependencies
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is required"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm is required"
    exit 1
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
python3 -m pip install -r requirements.txt -q

# Install frontend dependencies if needed
echo "Checking frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start backend
echo ""
echo "Starting backend on http://localhost:8080..."
cd "$SCRIPT_DIR/backend"
python3 server.py &
BACKEND_PID=$!

# Wait for backend to start (polling health endpoint)
MAX_ATTEMPTS=20
ATTEMPT=0
until curl -s http://localhost:8080/ > /dev/null; do
    ATTEMPT=$((ATTEMPT+1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "Error: Backend did not start within expected time."
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 0.5
done

# Start frontend
echo "Starting frontend on http://localhost:3000..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Dashboard running!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"

# Handle shutdown
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
