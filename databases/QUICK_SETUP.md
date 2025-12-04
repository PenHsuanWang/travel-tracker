# Database Preparation - Quick Reference

## One-Line Setup

```bash
# Complete database setup in one command
docker-compose -f docker-compose.dbonly.yml up -d \
	&& cd databases/minio && ./setup-buckets.sh && cd ../..
```

## Prerequisites Check

```bash
# Check Docker
docker --version

# Check Docker Compose
docker-compose --version

# Check MinIO Client
mc --version

# Install mc if needed
wget https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc && sudo mv mc /usr/local/bin/
```

## Setup Steps

### 1. Start Services (30 seconds)

```bash
docker-compose -f docker-compose.dbonly.yml up -d
docker ps  # Verify minio and mongodb are running
```

### 2. Setup Buckets (10 seconds)

```bash
cd databases/minio
./setup-buckets.sh
cd ../..
```

### 3. Verify (5 seconds)

```bash
mc ls myminio/  # Should show 4 buckets
curl http://localhost:9000/minio/health/live  # Should return success
```

## Quick Verification

```bash
# Check MinIO buckets
mc ls myminio/

# Expected output:
# [DATE] [TIME]     0B gps-analysis-data/
# [DATE] [TIME]     0B gis-data/
# [DATE] [TIME]     0B gps-data/
# [DATE] [TIME]     0B images/

# Check bucket contents
mc ls myminio/gis-data/  # Should show taiwan-river.pickle

# Check access policies
mc anonymous get myminio/images  # Should show "download"
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `mc: command not found` | Install mc or specify path: `./setup-buckets.sh /path/to/mc` |
| Port 9000 already in use | Change ports in `docker-compose.dbonly.yml` or stop the conflicting service |
| MinIO not accessible | Wait 10 seconds for startup, then check `docker logs minio` |
| Permission denied | Check Docker permissions or run with `sudo` |

## Backend Configuration

```bash
# Create server/.env
cat > server/.env <<'EOF'
PORT=5002

# MinIO Configuration
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

# MongoDB Configuration
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=travel_tracker

# Auth / API Settings
SECRET_KEY=your_super_secret_key_change_this_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REGISTRATION_KEY=admin_secret_key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5002
EOF
```

## Access Points

- **MinIO API:** <http://localhost:9000>
- **MinIO Console:** <http://localhost:9001> (minioadmin/minioadmin)
- **MongoDB:** mongodb://localhost:27017

## Bucket Structure

| Bucket | Purpose | Data Types | Size |
|--------|---------|------------|------|
| `gps-data` | Raw GPS tracks | GPX files | Variable |
| `gps-analysis-data` | Cached analysis artifacts | Pickle / JSON | Variable |
| `images` | Photos | JPEG, PNG with EXIF | Variable |
| `gis-data` | GIS datasets | Rivers, shapefiles | ~26MB |

## Quick Commands

```bash
# List files
mc ls myminio/images/

# Upload file
mc cp photo.jpg myminio/images/

# Download file
mc cp myminio/images/photo.jpg ./

# Check size
mc du myminio/gis-data

# Delete file
mc rm myminio/images/photo.jpg
```

## Cleanup

```bash
# Stop services
docker-compose -f docker-compose.dbonly.yml stop

# Remove containers (keeps data)
docker-compose -f docker-compose.dbonly.yml down

# Remove everything including data
docker-compose -f docker-compose.dbonly.yml down -v
```

## Full Documentation

- **Detailed Setup:** [databases/README.md](README.md)
- **MinIO Guide:** [databases/minio/README.md](minio/README.md)
- **API Review:** [MINIO_BUCKET_REVIEW.md](../MINIO_BUCKET_REVIEW.md)
- **Main README:** [README.md](../README.md)

---

**Total Setup Time:** ~45 seconds (after prerequisites installed)
