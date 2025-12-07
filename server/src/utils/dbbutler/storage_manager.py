"""Manager for coordinating multiple storage adapters.

The `StorageManager` provides a simple façade around multiple
`StorageAdapter` implementations (MinIO, MongoDB, Redis, etc.). It is used
by services that need to read/write data to one or more configured storage
backends.
"""

from typing import Dict, Any, Optional, Mapping
from src.utils.dbbutler.storage_adapter import StorageAdapter


class StorageManager:
    """Coordinator for registered storage adapters.

    Adapters are registered with `add_adapter(name, adapter)` and then
    addressed by name for load/save/delete operations. When `adapter_name`
    is omitted in save/delete operations the manager will operate across
    all registered adapters (backward compatibility behavior).
    """

    def __init__(self) -> None:
        """Initialize an empty StorageManager."""
        self.adapters: Dict[str, StorageAdapter] = {}

    def add_adapter(self, name: str, adapter: StorageAdapter) -> None:
        """Register a `StorageAdapter` instance under `name`."""
        self.adapters[name] = adapter

    def save_data(self, key: str, value: Any, adapter_name: str = None, **kwargs) -> None:
        """Save data to a specific adapter or to all adapters.

        Args:
            key (str): Logical key to store the value under.
            value (Any): The data to persist.
            adapter_name (str|None): If provided, target only this adapter.
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
        """Load data from a named adapter.

        Returns `None` when the adapter is not present or the key is missing.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.load_data(key, **kwargs)
        return None

    def delete_data(self, key: str, adapter_name: str = None, **kwargs) -> bool:
        """Delete data from a specific adapter or from all adapters.

        Returns True when any targeted adapter reports a deletion as
        successful.
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
        """Save multiple key/value pairs to all configured adapters."""
        for adapter in self.adapters.values():
            adapter.save_batch_data(data, **kwargs)

    def load_batch_data(self, name: str, keys: list, **kwargs) -> Mapping[str, Optional[Any]]:
        """Load multiple keys from a named adapter.

        Returns a mapping of key -> value. Missing keys map to `None`.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.load_batch_data(keys, **kwargs)
        return {}

    def delete_batch_data(self, keys: list, **kwargs) -> None:
        """Delete multiple keys from all configured adapters."""
        for adapter in self.adapters.values():
            adapter.delete_batch_data(keys, **kwargs)

    def exists(self, name: str, key: str, **kwargs) -> bool:
        """Check for the existence of `key` in the named adapter."""
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.exists(key, **kwargs)
        return False

    def list_keys(self, name: str, prefix: str = "", **kwargs) -> list:
        """List keys in a named adapter that match `prefix`."""
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.list_keys(prefix, **kwargs)
        return []
