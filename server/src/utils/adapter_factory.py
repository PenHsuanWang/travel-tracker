"""Adapter factory for creating configured storage adapters.

This module centralizes initialization of storage adapters used by the
backend (MinIO for object storage and MongoDB for document storage). The
factory reads configuration from environment variables and performs
minimal validation of required credentials.

Environment variables consumed:
    MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_SECURE
    MONGODB_HOST, MONGODB_PORT, MONGODB_DATABASE, MONGODB_USERNAME, MONGODB_PASSWORD

Only adapter construction is performed here; adapters returned are ready
to be added to the project's `StorageManager` or used directly.
"""

import os
from pathlib import Path
from src.utils.dbbutler.minio_adapter import MinIOAdapter
from src.utils.dbbutler.mongodb_adapter import MongoDBAdapter
from dotenv import load_dotenv

# Ensure .env is loaded from the server directory
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


class AdapterFactory:
    """Factory for creating storage adapters with proper configuration.

    This class centralizes adapter initialization to avoid duplication and
    provides convenience methods to construct adapters configured from
    environment variables.
    """

    @staticmethod
    def create_minio_adapter() -> MinIOAdapter:
        """Create and configure a MinIO adapter.

        Reads MinIO configuration from environment variables and validates
        that access credentials are present.

        Returns:
            MinIOAdapter: Configured MinIO adapter instance.

        Raises:
            ValueError: If ``MINIO_ACCESS_KEY`` or ``MINIO_SECRET_KEY`` are missing.
        """
        endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
        access_key = os.getenv("MINIO_ACCESS_KEY")
        secret_key = os.getenv("MINIO_SECRET_KEY")
        secure = os.getenv("MINIO_SECURE", "False").lower() == "true"

        if not access_key or not secret_key:
            raise ValueError(
                "MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set in environment variables"
            )

        return MinIOAdapter(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
    
    @staticmethod
    def create_mongodb_adapter() -> MongoDBAdapter:
        """Create and configure a MongoDB adapter.

        Reads MongoDB connection parameters from environment variables and
        returns a ready-to-use adapter instance.

        Returns:
            MongoDBAdapter: Configured MongoDB adapter instance.
        """
        host = os.getenv("MONGODB_HOST", "localhost")
        port = int(os.getenv("MONGODB_PORT", "27017"))
        db_name = os.getenv("MONGODB_DATABASE", "travel_tracker")
        username = os.getenv("MONGODB_USERNAME")
        password = os.getenv("MONGODB_PASSWORD")

        return MongoDBAdapter(
            host=host,
            port=port,
            db_name=db_name,
            username=username,
            password=password
        )
