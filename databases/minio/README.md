# MinIO Docker Setup

This guide explains how to set up MinIO using Docker. The updated configuration fixes the entrypoint issue present in the base MinIO image.

## Prerequisites

- Docker installed on your system.
- (Optional) MinIO Client (mc) installed on your host if you want to manage buckets from your machine.

## File Overview

- **Dockerfile:** Builds a Docker image based on the official MinIO image, overriding the default entrypoint.
- **minio-setup.sh:** A shell script that configures the MinIO client and creates necessary buckets.
- **README.md:** This guide.

## Step 1: Create Files

### Dockerfile

Create a file named `Dockerfile` with the following content:

```dockerfile
FROM minio/minio

# Set environment variables (replace with your desired credentials)
ENV MINIO_ACCESS_KEY=your-access-key
ENV MINIO_SECRET_KEY=your-secret-key

# Expose the MinIO ports
EXPOSE 9000
EXPOSE 9001

# Copy the setup script into the container
COPY minio-setup.sh /usr/bin/minio-setup.sh
RUN chmod +x /usr/bin/minio-setup.sh

# Override the base image entrypoint to allow our custom CMD to execute properly
ENTRYPOINT []

# Command to start MinIO server and run the setup script after a short delay
CMD ["sh", "-c", "minio server /data --console-address ':9001' & sleep 10 && /usr/bin/minio-setup.sh"]
```

### minio-setup.sh

Create a file named `minio-setup.sh` with the following content:

```bash
#!/bin/bash

# Configure the MinIO client
mc alias set myminio http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Create buckets
mc mb myminio/gps-data
mc mb myminio/images
mc mb myminio/gis-data

# Optionally, set buckets to public (uncomment if needed)
# mc policy set public myminio/gps-data
# mc policy set public myminio/images
# mc policy set public myminio/gis-data

echo "MinIO setup completed."
```

## Step 2: Build the Docker Image

Run the following command in the directory containing your files:

```bash
docker build -t myminio .
```

## Step 3: Run the MinIO Container

Use the following command to start the container:

```bash
docker run -d -p 9000:9000 -p 9001:9001 --name myminio -e MINIO_ACCESS_KEY=your-access-key -e MINIO_SECRET_KEY=your-secret-key myminio
```

> **Important:** Replace `your-access-key` and `your-secret-key` with your desired credentials if needed.

## Step 4: Verify the Setup

### Access the MinIO Console

Open your browser and navigate to [http://localhost:9001](http://localhost:9001). Log in using the credentials provided.

### Test the MinIO Setup Using the MinIO Client (mc)

1. **Install MinIO Client (mc):**  
   Follow the [MinIO Client Quickstart Guide](https://docs.min.io/docs/minio-client-quickstart-guide) if you haven't installed it already.

2. **Configure the MinIO Client:**

   ```bash
   mc alias set myminio http://localhost:9000 your-access-key your-secret-key
   ```

3. **List Buckets:**

   ```bash
   mc ls myminio
   ```

   You should see the following buckets:
   - `gps-data`
   - `images`
   - `gis-data`

    ![image](https://i.imgur.com/QqOq94V.png)

5. **Upload a Test File:**

   ```bash
   echo "This is a test file" > testfile.txt
   mc cp testfile.txt myminio/gps-data
   ```

5. **Verify File Upload:**

   ```bash
   mc ls myminio/gps-data
   ```
