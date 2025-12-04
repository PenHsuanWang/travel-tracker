# 🚀 Travel Tracker - Quick Start Guide

## 📋 Docker Compose Configurations

**Choose your setup:**

### 🔧 Development (Databases Only)
Run MongoDB and MinIO in Docker, develop backend/frontend on host:
```bash
docker-compose -f docker-compose.dbonly.yml up -d
```
Then run backend and frontend separately on your host machine.

### 🏗️ Production Build
Complete containerized stack (Frontend + Backend + Databases):
```bash
docker-compose -f docker-compose.build.yml up -d --build
```

**📚 See [DOCKER_COMPOSE_GUIDE.md](./DOCKER_COMPOSE_GUIDE.md) for detailed instructions**

---

## ✅ Current Status: ALL SYSTEMS RUNNING

### 🌐 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend UI** | http://localhost:3000 | React web application |
| **Backend API** | http://localhost:5002 | FastAPI REST API |
| **API Documentation** | http://localhost:5002/docs | Interactive Swagger UI |
| **MinIO Console** | http://localhost:9001 | Storage management UI |
| **MinIO API** | http://localhost:9000 | S3-compatible storage |

### 🔑 Default Credentials

**MinIO:**
- Access Key: `minioadmin`
- Secret Key: `minioadmin`

---

## 🎯 Tested Features

### ✅ Working Functionality:
1. ✅ Multi-layer basemaps with river overlays and cached GeoJSON data
2. ✅ GPX upload, parsing, auto-centering, and trip stats via `TripStatsHUD`
3. ✅ Image uploads with EXIF extraction, gallery + timeline views, and note editing
4. ✅ File management APIs (list, download, delete) across `gps-data`, `images`, `gps-analysis-data`, `gis-data`
5. ✅ Map generation + GIS endpoints (search/filter rivers, generate GIS map payloads)
6. ✅ Health-checked FastAPI backend with Swagger docs and MinIO console access

### ⚠️ Not Yet Implemented:
- In-map GPX polyline styling driven by EXIF timestamps
- Automatic photo markers/thumbnails directly on the Leaflet map
- User authentication & authorization flows
- File upload size enforcement + quota management

---

## 🧪 API Testing Examples

### Get Available Map Layers
```bash
curl http://localhost:5002/api/map/layers
```

### Generate a Map
```bash
curl -X POST http://localhost:5002/api/map/generate_map \
  -H "Content-Type: application/json" \
  -d '{"layer": "openstreetmap", "center": [25.0330, 121.5654]}'
```

### Upload a GPX File
```bash
curl -X POST http://localhost:5002/api/map/upload \
  -F "file=@/path/to/your/track.gpx"
```

### List Uploaded GPX Files
```bash
curl http://localhost:5002/api/list-files?bucket_name=gps-data
```

### Get River Names
```bash
curl http://localhost:5002/api/gis/list_rivers
```

### Generate Map with Rivers
```bash
curl -X POST http://localhost:5002/api/gis/generate_gis_map \
  -H "Content-Type: application/json" \
  -d '{"layer": "openstreetmap", "center": [24.7553, 121.2906], "selected_rivers": ["基隆河", "淡水河"]}'
```

---

## 📝 How to Start Services

### Start Backend
```bash
cd server
source venv/bin/activate
python -m uvicorn src.app:app --host 0.0.0.0 --port 5002 --reload
```

### Start Frontend
```bash
cd client
npm start
```

### Start MinIO (if not running)
```bash
# Try to start an existing MinIO container; otherwise bring up the DB-only compose set
docker start minio || docker-compose -f docker-compose.dbonly.yml up -d
```

---

## 🛑 How to Stop Services

### Stop Backend
Press `Ctrl+C` in the backend terminal

### Stop Frontend
Press `Ctrl+C` in the frontend terminal

### Stop MinIO
```bash
docker stop minio
```

---

## 📊 Performance Metrics

- **API Response Time**: < 100ms (most endpoints)
- **Map Generation**: ~500ms
- **GIS Map with Rivers**: 1-2 seconds
- **File Upload**: < 500ms
- **Cached Data**: < 50ms

---

## 🏗️ Architecture Overview

```
Frontend (React) → Backend (FastAPI) → Storage (MinIO)
                       ↓
                   Controllers
                       ↓
                   Services
                       ↓
                Storage Adapters
```

---

## 📚 Additional Resources

- **Full Test Results**: `TEST_RESULTS_20251030.md`
- **API Documentation**: http://localhost:5002/docs
- **Repository**: `/home/pwang/pwang-dev/travel-tracker`

---

## ✅ System Health Check

Run this command to verify all services:
```bash
curl -s http://localhost:5002/api/map/layers && \
curl -s http://localhost:3000 | grep -q "React" && \
docker ps | grep -q minio && \
echo "✅ All services are running!"
```

---

## 🐛 Troubleshooting

### Backend not responding
```bash
cd server && source venv/bin/activate
python -m uvicorn src.app:app --host 0.0.0.0 --port 5002 --reload
```

### Frontend not loading
```bash
cd client && npm start
```

### MinIO connection errors
```bash
docker ps | grep minio  # Check if running
docker start minio || docker-compose -f docker-compose.dbonly.yml up -d  # Start if stopped
```

---

# 🐳 Docker Deployment Suite

> **Note:** This section consolidates the deployment documentation. For full details, see `DOCKER_README.md` and `DOCKER_DEPLOYMENT_GUIDE.md`.

## 1. Architecture Overview

The Docker setup orchestrates four services in a secure, isolated bridge network:

| Service | Container Name | Internal Port | Exposed Port | Description |
|---------|----------------|---------------|--------------|-------------|
| **Frontend** | `travel-tracker-frontend` | 80 | **80** | Nginx serving React build |
| **Backend** | `travel-tracker-backend` | 8000 | - | FastAPI (Non-root user) |
| **Database** | `travel-tracker-database` | 27017 | - | MongoDB 7 (Auth enabled) |
| **Storage** | `travel-tracker-storage` | 9000 | **9001** (Console) | MinIO S3-compatible |

**Key Features:**
- **Multi-stage Builds:** Optimized image sizes (Frontend ~50MB, Backend ~300MB).
- **Security:** Non-root users, strict network isolation, secrets management.
- **Persistence:** Named volumes (`mongo_data`, `minio_data`) ensure data survives restarts.
- **Health Checks:** Automatic dependency management (Backend waits for DB/Storage).

## 2. Local Build & Run (Development)

Use `docker-compose.build.yml` to build images locally and start the stack.

```bash
# Option 1: Build and Run in foreground
docker-compose -f docker-compose.build.yml up --build

# Option 2: Run in background (Detached)
docker-compose -f docker-compose.build.yml up --build -d

# Stop and remove containers
docker-compose -f docker-compose.build.yml down

# Stop and remove volumes (Clean Reset)
docker-compose -f docker-compose.build.yml down -v
```

**Configuration (`.env.local`):**
Create a `.env.local` file to override defaults if needed:
```env
FRONTEND_PORT=8080
MONGODB_PASSWORD=mysecret
```

## 3. Production Deployment Scripts

Use the provided shell scripts for a standardized deployment workflow.

### Step 1: Build Images
```bash
# Build with version tag
./build.sh --version 1.0.0
```

### Step 2: Configure Environment
```bash
cp .env.production.example .env.production
# Edit .env.production with your secure credentials
```

### Step 3: Deploy
```bash
# Deploy locally
./deploy.sh

# OR Deploy to remote server via SSH
./deploy.sh --remote user@example.com --version 1.0.0
```

## 4. Troubleshooting & Maintenance

| Issue | Solution |
|-------|----------|
| **Build Fails** | Run `docker-compose -f docker-compose.build.yml build --no-cache` to clear cache. |
| **DB Connection Error** | Check logs: `docker-compose -f docker-compose.build.yml logs database`. Ensure `.env` credentials match volume data. |
| **Port Conflict** | Change `FRONTEND_PORT` in `.env.local` or stop conflicting services (e.g., local Nginx/Apache). |
| **Permission Denied** | Ensure scripts are executable: `chmod +x build.sh deploy.sh`. |

**Useful Commands:**
```bash
# Check Service Status
docker-compose -f docker-compose.build.yml ps

# View Real-time Logs
docker-compose -f docker-compose.build.yml logs -f

# Access Backend Shell
docker exec -it travel-tracker-backend bash
```

---

**Last Updated**: November 30, 2025
**Status**: ✅ All Systems Operational
