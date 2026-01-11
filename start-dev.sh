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
    echo "$(date): Services stopped by user" >> /tmp/cf-auth-backend.log
    echo "$(date): Services stopped by user" >> /tmp/cf-auth-frontend.log
    kill $(jobs -p) 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

echo -e "${BLUE}📦 Installing dependencies if needed...${NC}"
pnpm install --silent 2>/dev/null || true

cd demo-app
pnpm install --silent 2>/dev/null || true
cd ..

echo ""
echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Clear old logs and add startup timestamp
echo "==================================" > /tmp/cf-auth-backend.log
echo "$(date): Starting backend..." >> /tmp/cf-auth-backend.log
echo "==================================" >> /tmp/cf-auth-backend.log
echo "" >> /tmp/cf-auth-backend.log

echo "==================================" > /tmp/cf-auth-frontend.log
echo "$(date): Starting frontend..." >> /tmp/cf-auth-frontend.log
echo "==================================" >> /tmp/cf-auth-frontend.log
echo "" >> /tmp/cf-auth-frontend.log

# Start backend in background
echo -e "${BLUE}🔧 Starting backend (http://localhost:8787)...${NC}"
pnpm run dev >> /tmp/cf-auth-backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
else
    echo -e "${YELLOW}⚠ Backend may have failed to start. Check /tmp/cf-auth-backend.log${NC}"
fi

# Start frontend in background
echo -e "${BLUE}🎨 Starting demo app (http://localhost:5173)...${NC}"
cd demo-app
pnpm run dev >> /tmp/cf-auth-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# Check if frontend started successfully
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Demo app running (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${YELLOW}⚠ Demo app may have failed to start. Check /tmp/cf-auth-frontend.log${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Development environment ready!${NC}"
echo ""
echo -e "  Backend:  ${BLUE}http://localhost:8787${NC}"
echo -e "  Frontend: ${BLUE}http://localhost:5173${NC}"
echo ""
echo -e "Streaming logs below. Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo "================================================================"
echo ""

# Tail both log files together
tail -f /tmp/cf-auth-backend.log /tmp/cf-auth-frontend.log
