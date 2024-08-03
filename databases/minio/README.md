# MinIO Docker Setup

This guide explains how to set up MinIO using Docker, including building the Docker image, running the container, and testing the setup.

## Prerequisites

- Docker installed on your system.

### Step 1: Create Dockerfile

Create a file named `Dockerfile` with the following content:

```dockerfile
# Set environment variables

ENV MINIO_ACCESS_KEY your-access-key
ENV MINIO_SECRET_KEY your-secret-key

### Expose the MinIO ports

EXPOSE 9000
EXPOSE 9001

# Copy the setup script into the container

COPY minio-setup.sh /usr/bin/minio-setup.sh
RUN chmod +x /usr/bin/minio-setup.sh

# Command to start MinIO server and run the setup script

CMD ["sh", "-c", "minio server /data --console-address ':9001' & sleep 10 && /usr/bin/minio-setup.sh"]
```

### Step 2: Create MinIO Setup Script

Create a script named `minio-setup.sh` with the following content. This script will be copied into the Docker container and run during initialization to create the necessary buckets.

```bash
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
```

### Step 3: Build the Docker Image

Use the following command to build the Docker image:

```bash
docker build -t myminio .
```

### Step 4: Run the MinIO Container

Use the following command to run the MinIO container:

```bash
docker run -d -p 9000:9000 -p 9001:9001 --name myminio -e MINIO_ACCESS_KEY=your-access-key -e MINIO_SECRET_KEY=your-secret-key myminio
```

### Step 5: Verify the Setup

#### Access MinIO Console

Open your browser and navigate to `http://localhost:9001`. Log in with the access key and secret key provided.

#### Test MinIO Setup

1. **Install MinIO Client (mc)**:
    Download and install the MinIO client from [MinIO Client Quickstart Guide](https://docs.min.io/docs/minio-client-quickstart-guide).

2. **Configure MinIO Client**:
    Use the following command to configure the MinIO client:

    ```bash
    mc alias set myminio http://localhost:9000 your-access-key your-secret-key
    ```

3. **List Buckets**:
    Use the following command to list the buckets created during setup:

    ```bash
    mc ls myminio
    ```

    You should see the following buckets:
    - gps-data
    - images
    - gis-data

4. **Upload a Test File**:
    Use the following command to upload a test file to one of the buckets:

    ```bash
    echo "This is a test file" > testfile.txt
    mc cp testfile.txt myminio/gps-data
    ```

5. **Verify File Upload**:
    Use the following command to verify that the file has been uploaded:

    ```bash
    mc ls myminio/gps-data
    ```

## Summary

By following these steps, you will have a MinIO server running in a Docker container with the necessary buckets created and ready for use. You can manage your MinIO server using the MinIO client (mc) and perform operations such as uploading, downloading, and listing files.

If you encounter any issues or have questions, feel free to open an issue or contact support.
