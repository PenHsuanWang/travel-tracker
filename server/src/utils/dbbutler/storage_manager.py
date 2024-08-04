# utils/storage_manager.py

from typing import Dict, Any
from src.utils.dbbutler.storage_adapter import StorageAdapter


class StorageManager:
    """
    Manager for coordinating multiple storage adapters.
    """

    def __init__(self) -> None:
        """
        Initialize StorageManager.
        """
        self.adapters: Dict[str, StorageAdapter] = {}

    def add_adapter(self, name: str, adapter: StorageAdapter) -> None:
        """
        Add a storage adapter.

        :param name: The name of the adapter.
        :param adapter: The storage adapter instance.
        """
        self.adapters[name] = adapter

    def save_data(self, key: str, value: Any, **kwargs) -> None:
        """
        Save data to all configured storage adapters.

        :param key: The key under which the data is to be saved.
        :param value: The data to be saved.
        """
        for adapter in self.adapters.values():
            adapter.save_data(key, value, **kwargs)

    def load_data(self, name: str, key: str, **kwargs) -> Any:
        """
        Load data from a specific storage adapter.

        :param name: The name of the adapter to load data from.
        :param key: The key for the data to be loaded.
        :return: The loaded data.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.load_data(key, **kwargs)
        return None

    def delete_data(self, key: str, **kwargs) -> None:
        """
        Delete data from all configured storage adapters.

        :param key: The key for the data to be deleted.
        """
        for adapter in self.adapters.values():
            adapter.delete_data(key, **kwargs)

    def save_batch_data(self, data: dict, **kwargs) -> None:
        """
        Save multiple data items to all configured storage adapters.

        :param data: Dictionary of key-value pairs to be saved.
        """
        for adapter in self.adapters.values():
            adapter.save_batch_data(data, **kwargs)

    def load_batch_data(self, name: str, keys: list, **kwargs) -> dict:
        """
        Load multiple data items from a specific storage adapter.

        :param name: The name of the adapter to load data from.
        :param keys: List of keys for the data to be loaded.
        :return: Dictionary of key-value pairs.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.load_batch_data(keys, **kwargs)
        return {}

    def delete_batch_data(self, keys: list, **kwargs) -> None:
        """
        Delete multiple data items from all configured storage adapters.

        :param keys: List of keys for the data to be deleted.
        """
        for adapter in self.adapters.values():
            adapter.delete_batch_data(keys, **kwargs)

    def exists(self, name: str, key: str, **kwargs) -> bool:
        """
        Check if a key exists in a specific storage adapter.

        :param name: The name of the adapter to check.
        :param key: The key to check for existence.
        :return: True if the key exists, False otherwise.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.exists(key, **kwargs)
        return False

    def list_keys(self, name: str, prefix: str = "", **kwargs) -> list:
        """
        List keys in a specific storage adapter matching a prefix.

        :param name: The name of the adapter to list keys from.
        :param prefix: The prefix to match keys.
        :return: List of keys.
        """
        adapter = self.adapters.get(name)
        if adapter:
            return adapter.list_keys(prefix, **kwargs)
        return []

