"""Coordinate reads and writes across storage adapters."""

from typing import Any, Dict, Mapping, Optional

from src.utils.dbbutler.storage_adapter import StorageAdapter


class StorageManager:
    """High-level facade that fans IO across named adapters."""

    def __init__(self) -> None:
        """Initialize an empty registry of adapters."""
        self.adapters: Dict[str, StorageAdapter] = {}

    def add_adapter(self, name: str, adapter: StorageAdapter) -> None:
        """
        Register a storage adapter under a friendly name.

        :param name: Unique key callers use to reference the adapter.
        :param adapter: Concrete :class:`StorageAdapter` implementation.
        """
        self.adapters[name] = adapter

    def save_data(self, key: str, value: Any, adapter_name: str | None = None, **kwargs) -> None:
        """
        Persist data via a specific adapter or broadcast to all adapters.

        :param key: Identifier for the stored object.
        :param value: Payload to persist.
        :param adapter_name: Optional adapter identifier. When ``None`` the call fan-outs to every adapter.
        :raises ValueError: If a requested adapter has not been registered.
        """
        if adapter_name:
            # Save to specific adapter
            adapter = self.adapters.get(adapter_name)
            if adapter:
                adapter.save_data(key, value, **kwargs)
            else:
                raise ValueError(f"Adapter '{adapter_name}' not registered")
        else:
            # Save to all adapters (backward compatibility)
            for adapter in self.adapters.values():
                adapter.save_data(key, value, **kwargs)

    def load_data(self, name: str, key: str, **kwargs) -> Optional[Any]:
        """
        Retrieve an object from a specific adapter.

        :param name: Adapter identifier used during :meth:`add_adapter`.
        :param key: Identifier for the stored object.
        :return: Stored payload or ``None`` when the adapter is unknown.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.load_data(key, **kwargs)
        return None

    def delete_data(self, key: str, adapter_name: str | None = None, **kwargs) -> bool:
        """
        Remove an object from adapters.

        :param key: Identifier for the stored object.
        :param adapter_name: Optional adapter identifier restricting the delete call.
        :return: ``True`` if at least one adapter reports deletion.
        :raises ValueError: If ``adapter_name`` references an unknown adapter.
        """
        if adapter_name:
            adapter = self.adapters.get(adapter_name)
            if not adapter:
                raise ValueError(f"Adapter '{adapter_name}' not registered")
            result = adapter.delete_data(key, **kwargs)
            return bool(result)

        results = []
        for adapter in self.adapters.values():
            results.append(adapter.delete_data(key, **kwargs))
        return any(bool(result) for result in results)

    def save_batch_data(self, data: dict, **kwargs) -> None:
        """
        Persist multiple objects across every registered adapter.

        :param data: Mapping of key/value pairs to store.
        """
        for adapter in self.adapters.values():
            adapter.save_batch_data(data, **kwargs)

    def load_batch_data(self, name: str, keys: list, **kwargs) -> Mapping[str, Optional[Any]]:
        """
        Retrieve multiple records from a specific adapter.

        :param name: Adapter identifier.
        :param keys: Keys to request.
        :return: Mapping of key to payload. Empty mapping when adapter unknown.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.load_batch_data(keys, **kwargs)
        return {}

    def delete_batch_data(self, keys: list, **kwargs) -> None:
        """
        Delete multiple keys across every adapter.

        :param keys: Identifiers slated for deletion.
        """
        for adapter in self.adapters.values():
            adapter.delete_batch_data(keys, **kwargs)

    def exists(self, name: str, key: str, **kwargs) -> bool:
        """
        Determine whether a key exists within a specific adapter.

        :param name: Adapter identifier.
        :param key: Identifier to check.
        :return: Boolean result; ``False`` when adapter unknown.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.exists(key, **kwargs)
        return False

    def list_keys(self, name: str, prefix: str = "", **kwargs) -> list:
        """
        Enumerate keys from a specific adapter, optionally filtered by prefix.

        :param name: Adapter identifier.
        :param prefix: Prefix filter applied by the adapter implementation.
        :return: List of key strings. Empty when adapter unknown.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.list_keys(prefix, **kwargs)
        return []
