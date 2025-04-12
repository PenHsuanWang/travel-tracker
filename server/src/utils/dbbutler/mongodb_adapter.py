# utils/mongodb_adapter.py

from pymongo import MongoClient
from typing import Mapping, Any, Optional, Dict, List
from src.utils.dbbutler.storage_adapter import StorageAdapter


class MongoDBAdapter(StorageAdapter):
    """
    Adapter for MongoDB storage.
    """

    def __init__(self, host: str = 'localhost', port: int = 27017, db_name: str = 'mydatabase'):
        """
        Initialize MongoDBAdapter.

        :param host: The MongoDB server host.
        :param port: The MongoDB server port.
        :param db_name: The database name to use in MongoDB.
        """
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
        except Exception as e:
            print(f"Error saving batch data: {e}")
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
        except Exception as e:
            print(f"Error deleting batch data: {e}")
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