#!/bin/bash
set -e

# Start the MinIO server in the background
minio server /data --console-address ':9001' &
MINIO_PID=$!

# Allow time for MinIO to initialize
sleep 10

# Run the setup script to configure aliases and create buckets
/usr/bin/minio-setup.sh

# Keep the container running by waiting on the MinIO server process
wait $MINIO_PID