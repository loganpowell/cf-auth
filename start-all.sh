#!/bin/bash

# Start cf-auth backend + demo-app + desktop app
# Use this to test all three applications at once

set -e

echo "🚀 Starting ALL applications (backend + web + desktop)..."
echo ""

# Start backend and web app first
./start-dev.sh &
DEV_PID=$!

# Wait for services to be ready
sleep 5

# Start desktop app
echo "🖥️  Starting Tauri desktop app..."
cd ../desktop-app

if [ ! -d "node_modules" ]; then
    echo "📦 Installing desktop app dependencies..."
    pnpm install
fi

pnpm tauri dev &
DESKTOP_PID=$!

echo ""
echo "🎉 All applications started!"
echo ""
echo "  Backend:  http://localhost:8787"
echo "  Web App:  http://localhost:5173"
echo "  Desktop:  Tauri window should open"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    kill $DEV_PID $DESKTOP_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Wait
wait
