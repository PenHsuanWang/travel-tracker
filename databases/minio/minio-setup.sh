#!/bin/bash
set -e

echo "=== MinIO Bucket Setup Script ==="
echo "This script will configure MinIO buckets for the Travel Tracker application"
echo ""

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
    sleep 2
done
echo "✓ MinIO is ready"

# Configure the MinIO client alias
echo "Configuring MinIO client..."
mc alias set myminio http://localhost:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin}
echo "✓ MinIO client configured"

# Create buckets if they don't already exist
echo ""
echo "Creating buckets..."

if mc mb myminio/gps-data 2>/dev/null; then
    echo "✓ Created bucket: gps-data"
else
    echo "✓ Bucket already exists: gps-data"
fi

if mc mb myminio/images 2>/dev/null; then
    echo "✓ Created bucket: images"
else
    echo "✓ Bucket already exists: images"
fi

if mc mb myminio/gis-data 2>/dev/null; then
    echo "✓ Created bucket: gis-data"
else
    echo "✓ Bucket already exists: gis-data"
fi

# Set public read access for buckets
echo ""
echo "Setting bucket access policies..."
mc anonymous set download myminio/gps-data
echo "✓ Set public read access: gps-data"

mc anonymous set download myminio/images
echo "✓ Set public read access: images"

mc anonymous set download myminio/gis-data
echo "✓ Set public read access: gis-data"

# List all buckets to verify
echo ""
echo "=== Bucket Configuration Summary ==="
mc ls myminio/

echo ""
echo "=== MinIO setup completed successfully! ==="
echo ""
echo "Access Points:"
echo "  - MinIO API: http://localhost:9000"
echo "  - MinIO Console: http://localhost:9001"
echo "  - Username: minioadmin"
echo "  - Password: minioadmin"
echo ""
echo "Buckets created:"
echo "  - gps-data   : For GPX track files"
echo "  - images     : For geotagged photos"
echo "  - gis-data   : For GIS data (rivers, maps)"
echo ""