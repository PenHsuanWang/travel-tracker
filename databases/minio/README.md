# MinIO Setup for Travel Tracker

This guide explains how to set up MinIO storage for the Travel Tracker application. MinIO provides object storage for GPX files, images, and GIS data.

## Prerequisites

- Docker and Docker Compose installed on your system
- MinIO Client (mc) installed on your host (required for bucket setup)
- At least 1GB of free disk space

## Quick Start

### 1. Install MinIO Client (mc)

**Linux/macOS:**
```bash
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
# Or add to PATH: export PATH="$HOME/minio-binaries:$PATH"
```

**Windows:**
Download from: https://dl.min.io/client/mc/release/windows-amd64/mc.exe

**Verify installation:**
```bash
mc --version
```

### 2. Start MinIO Container

From the project root directory:

```bash
# Start MinIO container
docker-compose up -d minio

# Check if MinIO is running
docker ps | grep minio

# Check MinIO health
curl http://localhost:9000/minio/health/live
```

### 3. Setup Buckets

Run the automated setup script:

```bash
# From project root
cd databases/minio
./setup-buckets.sh

# Or if mc is not in PATH
./setup-buckets.sh /path/to/mc
```

The script will:
- ✓ Configure MinIO client
- ✓ Create required buckets (gps-data, images, gis-data)
- ✓ Set public read access policies
- ✓ Upload GIS data if available
- ✓ Display configuration summary

### 4. Verify Setup

**Check buckets:**
```bash
mc ls myminio/
```

**Check bucket sizes:**
```bash
mc du myminio/gis-data
mc du myminio/images
mc du myminio/gps-data
```

**Access MinIO Console:**
Open http://localhost:9001 in your browser
- Username: `minioadmin`
- Password: `minioadmin`

## Bucket Structure

The application uses three buckets:

| Bucket | Purpose | Data Types | Access |
|--------|---------|------------|--------|
| `gps-data` | GPS track files | GPX files | Public read |
| `images` | Geotagged photos | JPEG, PNG with EXIF | Public read |
| `gis-data` | GIS data | Rivers, shapefiles, pickle | Public read |

## Manual Setup (Alternative)

If you prefer manual setup or the script fails:

### 1. Configure mc client
```bash
mc alias set myminio http://localhost:9000 minioadmin minioadmin
```

### 2. Create buckets
```bash
mc mb myminio/gps-data
mc mb myminio/images
mc mb myminio/gis-data
```

### 3. Set access policies
```bash
mc anonymous set download myminio/gps-data
mc anonymous set download myminio/images
mc anonymous set download myminio/gis-data
```

### 4. Upload GIS data (optional)
```bash
# Example: Upload Taiwan river data
mc cp /path/to/taiwan-river.pickle myminio/gis-data/
```

## Configuration

### Environment Variables

The setup script respects these environment variables:

```bash
# MinIO endpoint (default: localhost:9000)
export MINIO_ENDPOINT="localhost:9000"

# Access credentials (default: minioadmin/minioadmin)
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"

# GIS data file location (optional)
export GIS_DATA_FILE="/path/to/taiwan-river.pickle"
```

### Docker Compose Configuration

The MinIO service is configured in `docker-compose.yml`:

```yaml
minio:
  image: minio/minio:latest
  container_name: minio
  ports:
    - "9000:9000"  # API
    - "9001:9001"  # Console
  environment:
    - MINIO_ROOT_USER=minioadmin
    - MINIO_ROOT_PASSWORD=minioadmin
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Data Management

### Upload Files via mc

```bash
# Upload a GPX file
mc cp track.gpx myminio/gps-data/

# Upload an image
mc cp photo.jpg myminio/images/

# Upload multiple files
mc cp *.gpx myminio/gps-data/

# Mirror a directory
mc mirror ./photos/ myminio/images/
```

### Download Files

```bash
# Download a file
mc cp myminio/gis-data/taiwan-river.pickle ./

# Download entire bucket
mc mirror myminio/images/ ./local-images/
```

### List Files

```bash
# List files in a bucket
mc ls myminio/images/

# List recursively
mc ls -r myminio/gps-data/

# Show file sizes
mc du myminio/gis-data/
```

### Delete Files

```bash
# Delete a file
mc rm myminio/images/photo.jpg

# Delete multiple files
mc rm --recursive --force myminio/gps-data/old/
```

## Troubleshooting

### MinIO Not Accessible

**Problem:** `curl http://localhost:9000/minio/health/live` fails

**Solution:**
```bash
# Check if container is running
docker ps | grep minio

# Check container logs
docker logs minio

# Restart container
docker-compose restart minio

# Full restart
docker-compose down
docker-compose up -d minio
```

### mc Command Not Found

**Problem:** `mc: command not found`

**Solution:**
```bash
# Check if mc is installed
which mc

# Add to PATH if installed in custom location
export PATH="$HOME/minio-binaries:$PATH"

# Or specify full path to setup script
./setup-buckets.sh /path/to/mc
```

### Permission Denied

**Problem:** Cannot create buckets or set policies

**Solution:**
```bash
# Check MinIO credentials
mc alias ls myminio

# Reconfigure with correct credentials
mc alias set myminio http://localhost:9000 minioadmin minioadmin

# Check if user has admin access
mc admin info myminio
```

### Bucket Already Exists

**Problem:** Bucket creation fails with "Bucket exists"

**Solution:**
This is normal - the setup script handles this gracefully. The bucket will be reused.

### Port Already in Use

**Problem:** MinIO won't start - port 9000 or 9001 in use

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :9000
sudo lsof -i :9001

# Stop conflicting service or change MinIO ports in docker-compose.yml
# Example: Change to 19000:9000 and 19001:9001
```

## Advanced Usage

### Bucket Versioning

Enable versioning to keep file history:

```bash
mc version enable myminio/images
mc version info myminio/images
```

### Bucket Lifecycle

Set up automatic cleanup of old files:

```bash
# Create lifecycle policy file
cat > lifecycle.json << EOF
{
  "Rules": [
    {
      "ID": "DeleteOldFiles",
      "Status": "Enabled",
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
EOF

# Apply lifecycle policy
mc ilm import myminio/gps-data < lifecycle.json
```

### Bucket Replication

For backup/disaster recovery:

```bash
# Configure remote MinIO
mc alias set minio-backup http://backup-server:9000 admin password

# Enable versioning (required for replication)
mc version enable myminio/images
mc version enable minio-backup/images

# Set up replication
mc replicate add myminio/images --remote-bucket http://admin:password@backup-server:9000/images
```

### Monitoring

Check bucket statistics:

```bash
# Get bucket size and object count
mc du myminio/images

# Watch bucket in real-time
mc watch myminio/images

# Get detailed stats
mc stat myminio/gis-data/taiwan-river.pickle
```

## Integration with Application

The Travel Tracker backend automatically connects to MinIO using these settings:

**Backend Configuration (`server/.env`):**
```env
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
```

**API Endpoints:**
- `POST /api/map/upload` - Upload files (auto-routes to correct bucket)
- `GET /api/list-files?bucket=images` - List files
- `GET /api/files/{filename}?bucket=images` - Download files
- `GET /api/images/geo` - Get geotagged images
- `DELETE /api/map/delete/{filename}` - Delete files

## Security Considerations

### For Development

Current setup uses default credentials - **DO NOT use in production**

### For Production

1. **Change default credentials:**
```bash
# In docker-compose.yml
environment:
  - MINIO_ROOT_USER=your-secure-username
  - MINIO_ROOT_PASSWORD=your-secure-password
```

2. **Use HTTPS:**
```bash
# Configure TLS certificates
command: server /data --console-address ":9001" --certs-dir /certs
volumes:
  - ./certs:/certs
```

3. **Restrict bucket access:**
```bash
# Set private access and use pre-signed URLs
mc anonymous set none myminio/images

# Application generates temporary URLs for access
```

4. **Enable audit logging:**
```bash
mc admin config set myminio audit_webhook:1 endpoint="http://your-log-server"
```

## Backup and Recovery

### Backup Buckets

```bash
# Backup to local directory
mc mirror myminio/gis-data ./backups/gis-data/

# Backup to another MinIO server
mc mirror myminio/images minio-backup/images
```

### Restore from Backup

```bash
# Restore from local directory
mc mirror ./backups/gis-data/ myminio/gis-data/

# Restore from another MinIO server
mc mirror minio-backup/images myminio/images
```

### Automated Backup Script

```bash
#!/bin/bash
# backup-minio.sh
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/minio/$DATE"

mkdir -p "$BACKUP_DIR"
mc mirror myminio/gis-data "$BACKUP_DIR/gis-data"
mc mirror myminio/images "$BACKUP_DIR/images"
mc mirror myminio/gps-data "$BACKUP_DIR/gps-data"

# Keep only last 7 days
find /backups/minio -type d -mtime +7 -exec rm -rf {} +
```

## File Overview

- **setup-buckets.sh:** Automated bucket setup script (recommended)
- **minio-setup.sh:** Docker container initialization script
- **Dockerfile:** Custom MinIO image with setup script
- **entrypoint.sh:** Container entrypoint
- **README.md:** This guide

## Quick Reference

### Common Commands

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

# List files with details
mc ls --recursive --summarize myminio/

# Check access policy
mc anonymous get myminio/images
```

### Access URLs

- **MinIO API:** http://localhost:9000
- **MinIO Console:** http://localhost:9001
- **Health Check:** http://localhost:9000/minio/health/live

### Default Credentials

- **Username:** minioadmin
- **Password:** minioadmin

## Additional Resources

- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [MinIO Client Guide](https://min.io/docs/minio/linux/reference/minio-mc.html)
- [MinIO Docker Hub](https://hub.docker.com/r/minio/minio)
- [Travel Tracker Documentation](../../MINIO_BUCKET_REVIEW.md)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [MINIO_BUCKET_REVIEW.md](../../MINIO_BUCKET_REVIEW.md) document
3. Check MinIO logs: `docker logs minio`
4. Check container status: `docker ps | grep minio`

---

**Last Updated:** 2025-11-20  
**Version:** 2.0

---

**Note:** The old Docker build method is no longer needed. The setup script works with the official MinIO Docker image from docker-compose.yml.

