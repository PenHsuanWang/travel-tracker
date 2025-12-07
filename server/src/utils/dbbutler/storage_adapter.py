"""Abstract storage adapter interface.

Implementations must subclass `StorageAdapter` and provide concrete
behaviour for saving, loading, deleting and enumerating keys.
"""

from abc import ABC, abstractmethod
from typing import Any


class StorageAdapter(ABC):
    """Interface for pluggable storage backends used by `StorageManager`."""

    @abstractmethod
    def save_data(self, key: str, value: Any, **kwargs) -> None:
        """Persist `value` under `key`.

        Implementations should accept backend-specific kwargs (e.g. bucket
        or collection names) via `**kwargs`.
        """
        pass

    @abstractmethod
    def load_data(self, key: str, **kwargs) -> Any:
        """Load and return the value for `key`, or `None` when missing."""
        pass

    @abstractmethod
    def delete_data(self, key: str, **kwargs) -> None:
        """Delete the item identified by `key` from storage."""
        pass

    @abstractmethod
    def save_batch_data(self, data: dict, **kwargs) -> None:
        """Persist multiple key->value pairs in a single operation."""
        pass

    @abstractmethod
    def load_batch_data(self, keys: list, **kwargs) -> dict:
        """Load multiple keys and return a dict mapping key->value."""
        pass

    @abstractmethod
    def delete_batch_data(self, keys: list, **kwargs) -> None:
        """Delete multiple keys in a batch operation."""
        pass

    @abstractmethod
    def exists(self, key: str, **kwargs) -> bool:
        """Return True when `key` exists in storage, False otherwise."""
        pass

    @abstractmethod
    def list_keys(self, prefix: str = "", **kwargs) -> list:
        """Return a list of keys matching `prefix`."""
        pass

