# server/src/utils/adapter_factory.py

import os
from src.utils.dbbutler.minio_adapter import MinIOAdapter
from dotenv import load_dotenv

load_dotenv()


class AdapterFactory:
    """
    Factory class for creating storage adapters with proper configuration.
    Centralizes adapter initialization to avoid code duplication.
    """

    @staticmethod
    def create_minio_adapter() -> MinIOAdapter:
        """
        Create and configure a MinIO adapter using environment variables.

        :return: Configured MinIOAdapter instance.
        :raises ValueError: If required environment variables are not set.
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
