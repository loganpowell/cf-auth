#!/bin/bash

# Development startup script for cf-auth + demo-app
# Starts both backend and frontend in parallel

set -e

echo "🚀 Starting cf-auth development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from cf-auth directory"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    echo "Install with: npm install -g pnpm"
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $(jobs -p) 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

echo "${BLUE}📦 Installing dependencies if needed...${NC}"
pnpm install --silent 2>/dev/null || true

cd demo-app
pnpm install --silent 2>/dev/null || true
cd ..

echo ""
echo "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Start backend in background
echo "${BLUE}🔧 Starting backend (http://localhost:8787)...${NC}"
pnpm run dev > /tmp/cf-auth-backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
else
    echo "${YELLOW}⚠ Backend may have failed to start. Check /tmp/cf-auth-backend.log${NC}"
fi

# Start frontend in background
echo "${BLUE}🎨 Starting demo app (http://localhost:5173)...${NC}"
cd demo-app
pnpm run dev > /tmp/cf-auth-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# Check if frontend started successfully
if ps -p $FRONTEND_PID > /dev/null; then
    echo "${GREEN}✓ Demo app running (PID: $FRONTEND_PID)${NC}"
else
    echo "${YELLOW}⚠ Demo app may have failed to start. Check /tmp/cf-auth-frontend.log${NC}"
fi

echo ""
echo "${GREEN}🎉 Development environment ready!${NC}"
echo ""
echo "  Backend:  ${BLUE}http://localhost:8787${NC}"
echo "  Frontend: ${BLUE}http://localhost:5173${NC}"
echo ""
echo "  Backend logs:  tail -f /tmp/cf-auth-backend.log"
echo "  Frontend logs: tail -f /tmp/cf-auth-frontend.log"
echo ""
echo "Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo ""

# Wait for both processes
wait
