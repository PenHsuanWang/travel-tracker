# utils/storage_adapter.py

from abc import ABC, abstractmethod
from typing import Any


class StorageAdapter(ABC):
    """
    Abstract base class for storage adapters.
    """

    @abstractmethod
    def save_data(self, key: str, value: Any, **kwargs) -> None:
        """
        Save data to the storage.

        :param key: The key under which the data is to be saved.
        :param value: The data to be saved.
        """
        pass

    @abstractmethod
    def load_data(self, key: str, **kwargs) -> Any:
        """
        Load data from the storage.

        :param key: The key for the data to be loaded.
        :return: The loaded data.
        """
        pass

    @abstractmethod
    def delete_data(self, key: str, **kwargs) -> None:
        """
        Delete data from the storage.

        :param key: The key for the data to be deleted.
        """
        pass

    @abstractmethod
    def save_batch_data(self, data: dict, **kwargs) -> None:
        """
        Save multiple data items to the storage.

        :param data: Dictionary of key-value pairs to be saved.
        """
        pass

    @abstractmethod
    def load_batch_data(self, keys: list, **kwargs) -> dict:
        """
        Load multiple data items from the storage.

        :param keys: List of keys for the data to be loaded.
        :return: Dictionary of key-value pairs.
        """
        pass

    @abstractmethod
    def delete_batch_data(self, keys: list, **kwargs) -> None:
        """
        Delete multiple data items from the storage.

        :param keys: List of keys for the data to be deleted.
        """
        pass

    @abstractmethod
    def exists(self, key: str, **kwargs) -> bool:
        """
        Check if a key exists in the storage.

        :param key: The key to check for existence.
        :return: True if the key exists, False otherwise.
        """
        pass

    @abstractmethod
    def list_keys(self, prefix: str = "", **kwargs) -> list:
        """
        List keys in the storage matching a prefix.

        :param prefix: The prefix to match keys.
        :return: List of keys.
        """
        pass

