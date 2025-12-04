"""Configuration management for the Travel Tracker backend.

This module centralizes environment variable loading and provides typed
configuration objects for services and adapters.
"""

import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "Travel Tracker API"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "*"
    PORT: int = 5002
    REGISTRATION_KEY: str = "admin_secret_key"

    # MongoDB
    MONGODB_HOST: str = "localhost"
    MONGODB_PORT: int = 27017
    MONGODB_DATABASE: str = "travel_tracker"
    MONGODB_USERNAME: str | None = None
    MONGODB_PASSWORD: str | None = None

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str | None = None
    MINIO_SECRET_KEY: str | None = None
    MINIO_SECURE: bool = False

    # Auth
    SECRET_KEY: str = "your-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = BASE_DIR / ".env"
        case_sensitive = True

    def cors_origins(self) -> list[str]:
        """Return the ALLOWED_ORIGINS string as a sanitized list."""

        if not self.ALLOWED_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached instance of the application settings."""
    return Settings()


def configure_logging() -> None:
    """Configure application-wide logging based on environment settings."""

    settings = get_settings()
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
