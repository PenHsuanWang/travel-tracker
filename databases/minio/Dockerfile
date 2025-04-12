FROM minio/minio

# Set environment variables (replace with your desired credentials)
ENV MINIO_ACCESS_KEY=your-access-key
ENV MINIO_SECRET_KEY=your-secret-key

# Expose the MinIO ports
EXPOSE 9000
EXPOSE 9001

# Copy the setup and entrypoint scripts into the container
COPY minio-setup.sh /usr/bin/minio-setup.sh
COPY entrypoint.sh /usr/bin/entrypoint.sh

# Set executable permissions on the scripts
RUN chmod +x /usr/bin/minio-setup.sh /usr/bin/entrypoint.sh

# Override the base image entrypoint so our script is executed as PID 1
ENTRYPOINT []

# Run our custom entrypoint script as the container's main process
CMD ["/usr/bin/entrypoint.sh"]