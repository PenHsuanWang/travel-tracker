"""Shared abstract interface for every storage backend."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List


class StorageAdapter(ABC):
    """Defines the CRUD surface that every storage backend must implement."""

    @abstractmethod
    def save_data(self, key: str, value: Any, **kwargs) -> None:
        """
        Persist a single item in the storage backend.

        :param key: Unique identifier used by the backend.
        :param value: The payload to store.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def load_data(self, key: str, **kwargs) -> Any:
        """
        Retrieve a single item from the backend.

        :param key: Unique identifier of the stored object.
        :return: The stored payload.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def delete_data(self, key: str, **kwargs) -> None:
        """
        Remove an item from the backend.

        :param key: Unique identifier of the stored object.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def save_batch_data(self, data: Dict[str, Any], **kwargs) -> None:
        """
        Persist a batch of key/value pairs.

        :param data: Mapping of object identifiers to payloads.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def load_batch_data(self, keys: List[str], **kwargs) -> Dict[str, Any]:
        """
        Retrieve multiple objects in a single call.

        :param keys: Identifiers to fetch.
        :return: Mapping of key to payload.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def delete_batch_data(self, keys: List[str], **kwargs) -> None:
        """
        Delete several objects at once.

        :param keys: Identifiers slated for deletion.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def exists(self, key: str, **kwargs) -> bool:
        """
        Determine whether an object exists in the backend.

        :param key: Identifier to search for.
        :return: ``True`` when the object exists, otherwise ``False``.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

    @abstractmethod
    def list_keys(self, prefix: str = "", **kwargs) -> List[str]:
        """
        Enumerate keys that begin with a prefix.

        :param prefix: Optional prefix filter.
        :return: Collection of key strings.
        :raises NotImplementedError: Must be implemented by subclasses.
        """

        raise NotImplementedError

