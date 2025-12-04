"""Factory helpers for storage adapters."""

from src.config import get_settings
from src.utils.dbbutler.minio_adapter import MinIOAdapter
from src.utils.dbbutler.mongodb_adapter import MongoDBAdapter


class AdapterFactory:
    """Factory helpers for configuring storage adapters from environment settings."""

    @staticmethod
    def create_minio_adapter() -> MinIOAdapter:
        """
        Create and configure a MinIO adapter using environment variables.

        :return: Configured :class:`MinIOAdapter` instance.
        :raises ValueError: If required credentials are not provided.
        """
        settings = get_settings()
        endpoint = settings.MINIO_ENDPOINT
        access_key = settings.MINIO_ACCESS_KEY
        secret_key = settings.MINIO_SECRET_KEY
        secure = settings.MINIO_SECURE

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
        """
        Create and configure a MongoDB adapter using environment variables.

        :return: Configured :class:`MongoDBAdapter` instance.
        """
        settings = get_settings()
        host = settings.MONGODB_HOST
        port = settings.MONGODB_PORT
        db_name = settings.MONGODB_DATABASE
        username = settings.MONGODB_USERNAME
        password = settings.MONGODB_PASSWORD

        return MongoDBAdapter(
            host=host,
            port=port,
            db_name=db_name,
            username=username,
            password=password
        )
