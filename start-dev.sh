#!/bin/bash
# Development Startup Script for Travel Tracker

set -e

echo "🚀 Starting Travel Tracker Development Environment"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local max_attempts=30
    local attempt=0

    echo -n "⏳ Waiting for $service_name to be ready..."
    while ! nc -z $host $port 2>/dev/null; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo -e " ${RED}✗ Timeout${NC}"
            return 1
        fi
        sleep 1
        echo -n "."
    done
    echo -e " ${GREEN}✓${NC}"
    return 0
}

# Step 1: Check if Docker is running
echo "1️⃣  Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Step 2: Start Docker containers using docker-compose
echo ""
echo "2️⃣  Starting Docker containers..."

if [ -f "docker-compose.yml" ]; then
    echo "📦 Using docker-compose..."
    docker-compose up -d
    
    # Wait for services
    wait_for_service "MongoDB" "localhost" "27017" || {
        echo -e "${RED}✗ MongoDB failed to start${NC}"
        exit 1
    }
    
    wait_for_service "MinIO" "localhost" "9000" || {
        echo -e "${RED}✗ MinIO failed to start${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}⚠ docker-compose.yml not found, starting containers manually...${NC}"
    
    # Start MongoDB
    if docker ps -a --format '{{.Names}}' | grep -q '^mongodb$'; then
        echo "Starting existing MongoDB container..."
        docker start mongodb
    else
        echo "Creating new MongoDB container..."
        docker run -d --name mongodb -p 27017:27017 \
            -e MONGO_INITDB_DATABASE=travel_tracker \
            mongo:latest
    fi
    
    # Start MinIO
    if docker ps -a --format '{{.Names}}' | grep -q '^minio$'; then
        echo "Starting existing MinIO container..."
        docker start minio
    else
        echo "Creating new MinIO container..."
        docker run -d --name minio -p 9000:9000 -p 9001:9001 \
            -e MINIO_ROOT_USER=minioadmin \
            -e MINIO_ROOT_PASSWORD=minioadmin \
            minio/minio server /data --console-address ":9001"
    fi
    
    wait_for_service "MongoDB" "localhost" "27017"
    wait_for_service "MinIO" "localhost" "9000"
fi

echo -e "${GREEN}✓ All Docker containers running${NC}"

# Step 3: Check if backend is already running
echo ""
echo "3️⃣  Checking Backend Server..."
if check_port 5002; then
    echo -e "${YELLOW}⚠ Backend already running on port 5002${NC}"
else
    echo "Starting Backend Server..."
    cd server
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        echo -e "${RED}✗ Virtual environment not found. Please run: python -m venv venv${NC}"
        exit 1
    fi
    
    # Start backend in background
    source venv/bin/activate
    nohup python -m uvicorn src.app:app --host 0.0.0.0 --port 5002 --reload > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    
    cd ..
    
    # Wait for backend to be ready
    wait_for_service "Backend" "localhost" "5002" || {
        echo -e "${RED}✗ Backend failed to start. Check backend.log${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✓ Backend server started (PID: $BACKEND_PID)${NC}"
fi

# Step 4: Check if frontend is already running
echo ""
echo "4️⃣  Checking Frontend..."
if check_port 3000; then
    echo -e "${YELLOW}⚠ Frontend already running on port 3000${NC}"
else
    echo "Starting Frontend..."
    cd client
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Start frontend in background
    nohup npm start > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    
    cd ..
    
    echo -e "${GREEN}✓ Frontend server starting (PID: $FRONTEND_PID)${NC}"
    echo "   (It may take 10-20 seconds to compile)"
fi

# Step 5: Display service status
echo ""
echo "=================================================="
echo "✅ Development Environment Ready!"
echo "=================================================="
echo ""
echo "📊 Service Status:"
echo "  • MongoDB:  http://localhost:27017"
echo "  • MinIO:    http://localhost:9000 (Console: http://localhost:9001)"
echo "  • Backend:  http://localhost:5002 (API Docs: http://localhost:5002/docs)"
echo "  • Frontend: http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "  • Backend:  tail -f backend.log"
echo "  • Frontend: tail -f frontend.log"
echo ""
echo "🐳 Docker Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🛑 To stop all services:"
echo "  ./stop-dev.sh"
echo ""
echo "=================================================="
