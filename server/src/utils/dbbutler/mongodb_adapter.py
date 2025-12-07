"""MongoDB storage adapter implementation for document storage.

This adapter implements the `StorageAdapter` interface and provides a
minimal set of document operations used by the StorageManager.
"""

from pymongo import MongoClient
from typing import Mapping, Any, Optional, Dict, List
from src.utils.dbbutler.storage_adapter import StorageAdapter


class MongoDBAdapter(StorageAdapter):
    """Adapter backed by a MongoDB database.

    Args:
        host (str): Hostname of the MongoDB server.
        port (int): Port of the MongoDB server.
        db_name (str): Database name to use.
        username (Optional[str]): Username for auth (optional).
        password (Optional[str]): Password for auth (optional).
    """

    def __init__(self, host: str = 'localhost', port: int = 27017, db_name: str = 'mydatabase', username: Optional[str] = None, password: Optional[str] = None):
        if username and password:
            # When a root user is created via MONGO_INITDB_ROOT_USERNAME, it exists in the 'admin' database.
            # Specify authSource='admin' so authentication succeeds when connecting to the target database.
            self.client = MongoClient(host, port, username=username, password=password, authSource='admin')
        else:
            self.client = MongoClient(host, port)
        self.db = self.client[db_name]

    def get_collection(self, collection_name: str):
        """Return a PyMongo collection object for `collection_name`."""
        return self.db[collection_name]

    def save_data(self, key: str, value: Mapping[str, Any], **kwargs) -> None:
        """Persist `value` under `_id` == `key` in the named collection."""
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        collection.update_one({'_id': key}, {'$set': value}, upsert=True)

    def load_data(self, key: str, **kwargs) -> Optional[Mapping[str, Any]]:
        """Load a document by `_id` from the named collection."""
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        document = collection.find_one({'_id': key})
        return document if document else None

    def delete_data(self, key: str, **kwargs) -> bool:
        """Delete a document by `_id` from the named collection."""
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        result = collection.delete_one({'_id': key})
        return result.deleted_count > 0

    def save_batch_data(self, data: Dict[str, Mapping[str, Any]], **kwargs) -> bool:
        """Save multiple documents to the same named collection."""
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
        """Load multiple documents by `_id` from the named collection."""
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        return {key: self.load_data(key, collection_name=collection_name) for key in keys}

    def delete_batch_data(self, keys: List[str], **kwargs) -> bool:
        """Delete multiple documents by `_id` from the named collection."""
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
        """Return True when a document with `_id` == `key` exists."""
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        return collection.find_one({'_id': key}) is not None

    def list_keys(self, prefix: str = "", **kwargs) -> List[str]:
        """Return list of `_id` values that start with `prefix`."""
        collection_name = kwargs.get('collection_name')
        if not collection_name:
            raise ValueError("Collection name is required")
        collection = self.get_collection(collection_name)
        return [doc['_id'] for doc in collection.find({'_id': {'$regex': f'^{prefix}'}})]