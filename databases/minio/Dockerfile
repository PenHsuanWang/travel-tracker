FROM minio/minio

# Set environment variables
ENV MINIO_ACCESS_KEY root
ENV MINIO_SECRET_KEY root

# Expose the MinIO ports
EXPOSE 9000
EXPOSE 9001

# Copy the setup script into the container
COPY minio-setup.sh /usr/bin/minio-setup.sh
RUN chmod +x /usr/bin/minio-setup.sh

# Command to start MinIO server and run the setup script
CMD ["sh", "-c", "minio server /data --console-address ':9001' & sleep 10 && /usr/bin/minio-setup.sh"]