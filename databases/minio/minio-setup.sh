#!/bin/bash

# Configure MinIO client
mc alias set myminio http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Create buckets
mc mb myminio/gps-data
mc mb myminio/images
mc mb myminio/gis-data

# Set policy to public if needed
# mc policy set public myminio/gps-data
# mc policy set public myminio/images
# mc policy set public myminio/gis-data

echo "MinIO setup completed."