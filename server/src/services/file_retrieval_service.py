# src/services/file_retrieval_service.py

from typing import List, Optional
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.dbbutler.minio_adapter import MinIOAdapter

class FileRetrievalService:
    """
    Service for listing and retrieving files from MinIO.
    """
    def __init__(self):
        self.storage_manager = StorageManager()
        # Register the MinIO adapter here if not already done elsewhere.
        # Adjust endpoint, access_key, and secret_key for your actual MinIO config.
        minio_adapter = MinIOAdapter(
            endpoint="localhost:9000",
            access_key="your-access-key",
            secret_key="your-secret-key",
            secure=False
        )
        self.storage_manager.add_adapter('minio', minio_adapter)

    def list_files(self, bucket_name: str) -> List[str]:
        """
        List object keys in the given bucket.
        """
        return self.storage_manager.list_keys('minio', prefix="", bucket=bucket_name)

    def get_file_bytes(self, bucket_name: str, filename: str) -> Optional[bytes]:
        """
        Retrieve the raw bytes of a file from MinIO.
        Returns None if file doesn't exist.
        """
        # Check if the file exists in the bucket.
        exists = self.storage_manager.exists('minio', filename, bucket=bucket_name)
        if not exists:
            return None

        # Load the file bytes from MinIO.
        file_bytes = self.storage_manager.load_data('minio', filename, bucket=bucket_name)
        return file_bytes
