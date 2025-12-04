"""MongoDB storage adapter implementation."""

import logging
from typing import Any, Dict, List, Mapping, Optional

from pymongo import MongoClient

from src.utils.dbbutler.storage_adapter import StorageAdapter

logger = logging.getLogger(__name__)


class MongoDBAdapter(StorageAdapter):
    """
    Adapter for MongoDB storage.
    """

    def __init__(self, host: str = 'localhost', port: int = 27017, db_name: str = 'mydatabase', username: Optional[str] = None, password: Optional[str] = None):
        """
        Initialize MongoDBAdapter.

        :param host: The MongoDB server host.
        :param port: The MongoDB server port.
        :param db_name: The database name to use in MongoDB.
        :param username: The username for authentication (optional).
        :param password: The password for authentication (optional).
        """
        if username and password:
            # When a root user is created via MONGO_INITDB_ROOT_USERNAME, it exists in the 'admin' database.
            # Specify authSource='admin' so authentication succeeds when connecting to the target database.
            self.client = MongoClient(host, port, username=username, password=password, authSource='admin')
        else:
            self.client = MongoClient(host, port)
        self.db = self.client[db_name]

    def get_collection(self, collection_name: str):
        """
        Get the specified collection.

        :param collection_name: The collection name to use in MongoDB.
        :return: The collection object.
        """
        return self.db[collection_name]

    def save_data(self, key: str, value: Mapping[str, Any], **kwargs) -> None:
        """
        Save data to MongoDB.

        :param key: The key under which the data is to be saved.
        :param value: The data to be saved.
        :param kwargs: Additional parameters such as 'collection_name'.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        collection.update_one({'_id': key}, {'$set': value}, upsert=True)

    def load_data(self, key: str, **kwargs) -> Optional[Mapping[str, Any]]:
        """
        Load data from MongoDB.

        :param key: The key for the data to be loaded.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: The loaded data.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        document = collection.find_one({'_id': key})
        return document if document else None

    def delete_data(self, key: str, **kwargs) -> bool:
        """
        Delete data from MongoDB.

        :param key: The key for the data to be deleted.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: True if deletion was successful, False otherwise.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        result = collection.delete_one({'_id': key})
        return result.deleted_count > 0

    def save_batch_data(self, data: Dict[str, Mapping[str, Any]], **kwargs) -> bool:
        """
        Save multiple data items to MongoDB.

        :param data: Dictionary of key-value pairs to be saved.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: True if saving was successful, False otherwise.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        try:
            for key, value in data.items():
                self.save_data(key, value, collection_name=collection_name)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error saving batch data to collection %s", collection_name)
            return False

    def load_batch_data(self, keys: List[str], **kwargs) -> Dict[str, Optional[Mapping[str, Any]]]:
        """
        Load multiple data items from MongoDB.

        :param keys: List of keys for the data to be loaded.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: Dictionary of key-value pairs.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        return {key: self.load_data(key, collection_name=collection_name) for key in keys}

    def delete_batch_data(self, keys: List[str], **kwargs) -> bool:
        """
        Delete multiple data items from MongoDB.

        :param keys: List of keys for the data to be deleted.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: True if deletion was successful, False otherwise.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        try:
            for key in keys:
                self.delete_data(key, collection_name=collection_name)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error deleting batch data from collection %s", collection_name)
            return False

    def exists(self, key: str, **kwargs) -> bool:
        """
        Check if a key exists in MongoDB.

        :param key: The key to check for existence.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: True if the key exists, False otherwise.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        return collection.find_one({'_id': key}) is not None

    def list_keys(self, prefix: str = "", **kwargs) -> List[str]:
        """
        List keys in MongoDB matching a prefix.

        :param prefix: The prefix to match keys.
        :param kwargs: Additional parameters such as 'collection_name'.
        :return: List of keys.
        """
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        return [doc['_id'] for doc in collection.find({'_id': {'$regex': f'^{prefix}'}})]