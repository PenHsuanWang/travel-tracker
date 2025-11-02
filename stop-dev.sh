#!/bin/bash
# Stop Development Environment Script

set -e

echo "🛑 Stopping Travel Tracker Development Environment"
echo "=================================================="

GREEN='\033[0;32m'
NC='\033[0m'

# Stop backend
if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        rm backend.pid
        echo -e "${GREEN}✓ Backend stopped${NC}"
    fi
fi

# Stop frontend
if [ -f "frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        rm frontend.pid
        echo -e "${GREEN}✓ Frontend stopped${NC}"
    fi
fi

# Stop Docker containers (optional - uncomment if you want to stop them)
# echo "Stopping Docker containers..."
# docker-compose down
# echo -e "${GREEN}✓ Docker containers stopped${NC}"

echo ""
echo "=================================================="
echo "✅ Development environment stopped"
echo "=================================================="
echo ""
echo "Note: Docker containers are still running."
echo "To stop them: docker-compose down"
echo ""
