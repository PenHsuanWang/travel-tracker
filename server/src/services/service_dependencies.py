"""Helper utilities for wiring service dependencies.

These factories keep adapter construction centralized so individual services
can focus on business logic while still supporting dependency injection in
unit tests.
"""

from __future__ import annotations

from typing import Protocol

from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_adapter import StorageAdapter
from src.utils.dbbutler.storage_manager import StorageManager


class AdapterFactoryProtocol(Protocol):
    """Typed subset of :class:`AdapterFactory` used by the helpers."""

    @staticmethod
    def create_minio_adapter() -> StorageAdapter:  # pragma: no cover - protocol stub
        """Return a configured MinIO adapter."""

    @staticmethod
    def create_mongodb_adapter() -> StorageAdapter:  # pragma: no cover - protocol stub
        """Return a configured MongoDB adapter."""


def ensure_storage_manager(
    storage_manager: StorageManager | None = None,
    *,
    include_minio: bool = False,
    include_mongodb: bool = False,
    adapter_factory: AdapterFactoryProtocol = AdapterFactory,
) -> StorageManager:
    """Return a storage manager populated with the requested adapters.

    When ``storage_manager`` already provides the named adapter it is reused,
    allowing tests to pass fully stubbed managers. Otherwise the helper uses the
    provided ``adapter_factory`` (defaults to :class:`AdapterFactory`) to create
    real adapters from environment-backed settings.
    """

    manager = storage_manager or StorageManager()

    if include_minio and "minio" not in manager.adapters:
        manager.add_adapter("minio", adapter_factory.create_minio_adapter())

    if include_mongodb and "mongodb" not in manager.adapters:
        manager.add_adapter("mongodb", adapter_factory.create_mongodb_adapter())

    return manager
