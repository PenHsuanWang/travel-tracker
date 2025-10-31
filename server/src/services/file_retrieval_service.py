# src/services/file_retrieval_service.py

import os
from typing import List, Optional
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.dbbutler.minio_adapter import MinIOAdapter
from dotenv import load_dotenv

load_dotenv()

class FileRetrievalService:
    """
    Service for listing and retrieving files from MinIO.
    """
    def __init__(self):
        self.storage_manager = StorageManager()
        minio_adapter = MinIOAdapter(
            endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=os.getenv("MINIO_SECURE", "False").lower() == "true"
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
