from unittest.mock import patch

import pytest

from src.utils.adapter_factory import AdapterFactory


def test_minio_adapter_raises_without_credentials(monkeypatch):
    monkeypatch.setenv("MINIO_ENDPOINT", "localhost:9000")
    # Unset keys that would be read from environment
    monkeypatch.delenv("MINIO_ACCESS_KEY", raising=False)
    monkeypatch.delenv("MINIO_SECRET_KEY", raising=False)

    with pytest.raises(ValueError, match="MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set"):
        AdapterFactory.create_minio_adapter()


def test_minio_adapter_uses_environment_variables(monkeypatch):
    monkeypatch.setenv("MINIO_ENDPOINT", "minio.test")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "test_access")
    monkeypatch.setenv("MINIO_SECRET_KEY", "test_secret")
    monkeypatch.setenv("MINIO_SECURE", "true")

    with patch("src.utils.adapter_factory.MinIOAdapter") as mock_adapter:
        AdapterFactory.create_minio_adapter()

    mock_adapter.assert_called_once_with(
        endpoint="minio.test",
        access_key="test_access",
        secret_key="test_secret",
        secure=True,
    )


def test_mongodb_adapter_uses_environment_variables(monkeypatch):
    monkeypatch.setenv("MONGODB_HOST", "mongo.test")
    monkeypatch.setenv("MONGODB_PORT", "27018")
    monkeypatch.setenv("MONGODB_DATABASE", "testdb")
    monkeypatch.setenv("MONGODB_USERNAME", "testuser")
    monkeypatch.setenv("MONGODB_PASSWORD", "testpass")

    with patch("src.utils.adapter_factory.MongoDBAdapter") as mock_adapter:
        AdapterFactory.create_mongodb_adapter()

    mock_adapter.assert_called_once_with(
        host="mongo.test",
        port=27018,
        db_name="testdb",
        username="testuser",
        password="testpass",
    )
