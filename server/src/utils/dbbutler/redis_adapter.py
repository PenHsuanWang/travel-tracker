# utils/redis_adapter.py

import redis
from typing import Any
from src.utils.dbbutler.storage_adapter import StorageAdapter


class RedisAdapter(StorageAdapter):
    """
    Adapter for Redis storage.
    """

    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0):
        """
        Initialize RedisAdapter.

        :param host: The Redis server host.
        :param port: The Redis server port.
        :param db: The Redis database number.
        """
        self.client = redis.StrictRedis(host=host, port=port, db=db)

    def save_data(self, key: str, value: str) -> None:
        """
        Save data to Redis.

        :param key: The key under which the data is to be saved.
        :param value: The data to be saved.
        """
        self.client.set(key, value)

    def load_data(self, key: str) -> str:
        """
        Load data from Redis.

        :param key: The key for the data to be loaded.
        :return: The loaded data.
        """
        data = self.client.get(key)
        return data.decode('utf-8') if data else None

    def delete_data(self, key: str) -> None:
        """
        Delete data from Redis.

        :param key: The key for the data to be deleted.
        """
        self.client.delete(key)

    def save_batch_data(self, data: dict) -> None:
        """
        Save multiple data items to Redis.

        :param data: Dictionary of key-value pairs to be saved.
        """
        with self.client.pipeline() as pipe:
            for key, value in data.items():
                pipe.set(key, value)
            pipe.execute()

    def load_batch_data(self, keys: list) -> dict:
        """
        Load multiple data items from Redis.

        :param keys: List of keys for the data to be loaded.
        :return: Dictionary of key-value pairs.
        """
        with self.client.pipeline() as pipe:
            for key in keys:
                pipe.get(key)
            results = pipe.execute()
        return {key: result.decode('utf-8') if result else None for key, result in zip(keys, results)}

    def delete_batch_data(self, keys: list) -> None:
        """
        Delete multiple data items from Redis.

        :param keys: List of keys for the data to be deleted.
        """
        with self.client.pipeline() as pipe:
            for key in keys:
                pipe.delete(key)
            pipe.execute()

    def exists(self, key: str) -> bool:
        """
        Check if a key exists in Redis.

        :param key: The key to check for existence.
        :return: True if the key exists, False otherwise.
        """
        return self.client.exists(key)

    def list_keys(self, prefix: str = "*") -> list:
        """
        List keys in Redis matching a prefix.

        :param prefix: The prefix to match keys.
        :return: List of keys.
        """
        return [key.decode('utf-8') for key in self.client.keys(prefix)]

