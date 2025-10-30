# 🚀 Travel Tracker - Quick Start Guide

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
- Access Key: `your-access-key`
- Secret Key: `your-secret-key`

---

## 🎯 Tested Features

### ✅ Working Functionality:
1. ✅ View interactive maps with multiple tile layers
2. ✅ Upload GPX files to storage
3. ✅ Upload images to storage
4. ✅ List uploaded files
5. ✅ Download files from storage
6. ✅ Overlay GIS river data on maps
7. ✅ Search and filter rivers
8. ✅ Generate maps centered on specific coordinates
9. ✅ Toggle river layers on/off
10. ✅ View cached river GeoJSON data

### ⚠️ Not Yet Implemented:
- GPX track line visualization on maps
- Image geotagging from EXIF data
- Photo markers on maps
- Linking images to GPS tracks
- User authentication
- File upload size limits

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
docker start myminio
```

---

## 🛑 How to Stop Services

### Stop Backend
Press `Ctrl+C` in the backend terminal

### Stop Frontend
Press `Ctrl+C` in the frontend terminal

### Stop MinIO
```bash
docker stop myminio
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
docker ps | grep -q myminio && \
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
docker ps | grep myminio  # Check if running
docker start myminio      # Start if stopped
```

---

**Last Updated**: October 30, 2025
**Status**: ✅ All Systems Operational
