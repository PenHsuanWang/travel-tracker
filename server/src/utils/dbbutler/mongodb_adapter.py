# utils/mongodb_adapter.py

from pymongo import MongoClient
from src.utils.dbbutler.storage_adapter import StorageAdapter


class MongoDBAdapter(StorageAdapter):
    """
    Adapter for MongoDB storage.
    """

    def __init__(self, host: str = 'localhost', port: int = 27017, db_name: str = 'mydatabase', collection_name: str = 'mycollection'):
        """
        Initialize MongoDBAdapter.

        :param host: The MongoDB server host.
        :param port: The MongoDB server port.
        :param db_name: The database name to use in MongoDB.
        :param collection_name: The collection name to use in MongoDB.
        """
        self.client = MongoClient(host, port)
        self.db = self.client[db_name]
        self.collection = self.db[collection_name]

    def save_data(self, key: str, value: dict) -> None:
        """
        Save data to MongoDB.

        :param key: The key under which the data is to be saved.
        :param value: The data to be saved.
        """
        self.collection.update_one({'_id': key}, {'$set': value}, upsert=True)

    def load_data(self, key: str) -> dict:
        """
        Load data from MongoDB.

        :param key: The key for the data to be loaded.
        :return: The loaded data.
        """
        document = self.collection.find_one({'_id': key})
        return document if document else None

    def delete_data(self, key: str) -> None:
        """
        Delete data from MongoDB.

        :param key: The key for the data to be deleted.
        """
        self.collection.delete_one({'_id': key})

    def save_batch_data(self, data: dict) -> None:
        """
        Save multiple data items to MongoDB.

        :param data: Dictionary of key-value pairs to be saved.
        """
        for key, value in data.items():
            self.save_data(key, value)

    def load_batch_data(self, keys: list) -> dict:
        """
        Load multiple data items from MongoDB.

        :param keys: List of keys for the data to be loaded.
        :return: Dictionary of key-value pairs.
        """
        return {key: self.load_data(key) for key in keys}

    def delete_batch_data(self, keys: list) -> None:
        """
        Delete multiple data items from MongoDB.

        :param keys: List of keys for the data to be deleted.
        """
        for key in keys:
            self.delete_data(key)

    def exists(self, key: str) -> bool:
        """
        Check if a key exists in MongoDB.

        :param key: The key to check for existence.
        :return: True if the key exists, False otherwise.
        """
        return self.collection.find_one({'_id': key}) is not None

    def list_keys(self, prefix: str = "") -> list:
        """
        List keys in MongoDB matching a prefix.

        :param prefix: The prefix to match keys.
        :return: List of keys.
        """
        return [doc['_id'] for doc in self.collection.find({'_id': {'$regex': f'^{prefix}'}})]

