#!/bin/bash
set -e

# Configure the MinIO client alias
mc alias set myminio http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Create buckets if they don't already exist
mc mb myminio/gps-data || true
mc mb myminio/images   || true
mc mb myminio/gis-data || true

echo "MinIO setup completed."