# Database Setup Guide

Quick guide for setting up databases (MinIO and MongoDB) for Travel Tracker.

## Overview

Travel Tracker uses two database systems:

1. **MinIO** - Object storage for files (GPX, images, GIS data)
2. **MongoDB** - Metadata storage (optional)

## Prerequisites

- Docker and Docker Compose installed
- MinIO Client (mc) installed
- At least 1GB free disk space

## Quick Setup (Recommended)

### 1. Start Docker Services

```bash
# From project root
docker-compose up -d

# Verify services are running
docker ps
```

You should see:
- `minio` - Object storage (ports 9000, 9001)
- `mongodb` - Database (port 27017)

### 2. Setup MinIO Buckets

```bash
# Install MinIO Client if needed
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Run automated setup
cd databases/minio
./setup-buckets.sh
```

This will:
- ✓ Configure MinIO client
- ✓ Create 3 buckets (gps-data, images, gis-data)
- ✓ Set public read access policies
- ✓ Upload GIS data if available
- ✓ Display configuration summary

### 3. Verify Setup

**Check MinIO:**
```bash
mc ls myminio/
```

Expected output:
```
[DATE] [TIME]     0B gis-data/
[DATE] [TIME]     0B gps-data/
[DATE] [TIME]     0B images/
```

**Access MinIO Console:**
- URL: http://localhost:9001
- Username: minioadmin
- Password: minioadmin

**Check MongoDB:**
```bash
docker exec -it mongodb mongosh --eval "db.version()"
```

## Manual Setup (Alternative)

If the automated script fails:

### MinIO Setup

```bash
# Configure mc client
mc alias set myminio http://localhost:9000 minioadmin minioadmin

# Create buckets
mc mb myminio/gps-data
mc mb myminio/images
mc mb myminio/gis-data

# Set access policies
mc anonymous set download myminio/gps-data
mc anonymous set download myminio/images
mc anonymous set download myminio/gis-data

# Upload GIS data (optional)
mc cp /path/to/taiwan-river.pickle myminio/gis-data/
```

## Bucket Structure

| Bucket | Purpose | Data Types | Size |
|--------|---------|------------|------|
| `gps-data` | GPS tracks | GPX files | Variable |
| `images` | Photos | JPEG, PNG with EXIF | Variable |
| `gis-data` | GIS data | Rivers, shapefiles | ~26MB |

## Backend Configuration

Create `server/.env`:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

# MongoDB Configuration (optional)
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DB=travel_tracker
```

## Verification Checklist

- [ ] Docker containers running
- [ ] MinIO accessible at http://localhost:9000
- [ ] MinIO Console accessible at http://localhost:9001
- [ ] Three buckets created (gps-data, images, gis-data)
- [ ] Buckets have public read access
- [ ] GIS data uploaded to gis-data bucket
- [ ] MongoDB running on port 27017
- [ ] Backend .env file configured

## Troubleshooting

### MinIO Not Starting

```bash
# Check logs
docker logs minio

# Restart container
docker-compose restart minio

# Full restart
docker-compose down
docker-compose up -d
```

### mc Command Not Found

```bash
# Check if installed
which mc

# Add to PATH
export PATH="$HOME/minio-binaries:$PATH"

# Or specify path to setup script
./setup-buckets.sh /path/to/mc
```

### Port Already in Use

```bash
# Find what's using port 9000
sudo lsof -i :9000

# Change ports in docker-compose.yml if needed
```

### Cannot Access MinIO Console

```bash
# Wait for container to be ready
curl http://localhost:9000/minio/health/live

# Check if port is mapped correctly
docker port minio
```

## Common Commands

### MinIO Management

```bash
# List all buckets
mc ls myminio/

# Check bucket size
mc du myminio/images

# Upload file
mc cp file.jpg myminio/images/

# Download file
mc cp myminio/images/file.jpg ./

# Delete file
mc rm myminio/images/file.jpg

# List files recursively
mc ls --recursive myminio/gps-data/
```

### Docker Management

```bash
# View logs
docker logs minio
docker logs mongodb

# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart services
docker-compose restart

# Remove everything (data will be lost!)
docker-compose down -v
```

## Data Migration

### Export Data

```bash
# Backup all buckets
mc mirror myminio/gis-data ./backup/gis-data
mc mirror myminio/images ./backup/images
mc mirror myminio/gps-data ./backup/gps-data

# Backup MongoDB
docker exec mongodb mongodump --out=/dump
docker cp mongodb:/dump ./backup/mongodb
```

### Import Data

```bash
# Restore buckets
mc mirror ./backup/gis-data myminio/gis-data
mc mirror ./backup/images myminio/images
mc mirror ./backup/gps-data myminio/gps-data

# Restore MongoDB
docker cp ./backup/mongodb mongodb:/dump
docker exec mongodb mongorestore /dump
```

## Next Steps

After database setup:

1. Configure backend environment variables
2. Start backend server
3. Start frontend development server
4. Upload data via web UI or API

See main [README.md](../README.md) for full application setup.

## Additional Resources

- [MinIO Setup Guide](minio/README.md) - Detailed MinIO documentation
- [MinIO Bucket Review](../MINIO_BUCKET_REVIEW.md) - Comprehensive API review
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)

---

**Last Updated:** 2025-11-20
