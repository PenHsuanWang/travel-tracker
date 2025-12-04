# utils/redis_adapter.py

from redis import asyncio as aioredis
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
        self.client = aioredis.from_url(f"redis://{host}:{port}/{db}")

    async def save_data(self, key: str, value: str, **kwargs) -> None:
        """
        Save data to Redis.

        :param key: The key under which the data is to be saved.
        :param value: The data to be saved.
        """
        await self.client.set(key, value)

    async def load_data(self, key: str, **kwargs) -> str:
        """
        Load data from Redis.

        :param key: The key for the data to be loaded.
        :return: The loaded data.
        """
        data = await self.client.get(key)
        return data.decode('utf-8') if data else None

    async def delete_data(self, key: str, **kwargs) -> None:
        """
        Delete data from Redis.

        :param key: The key for the data to be deleted.
        """
        await self.client.delete(key)

    async def save_batch_data(self, data: dict, **kwargs) -> None:
        """
        Save multiple data items to Redis.

        :param data: Dictionary of key-value pairs to be saved.
        """
        async with self.client.pipeline() as pipe:
            for key, value in data.items():
                await pipe.set(key, value)
            await pipe.execute()

    async def load_batch_data(self, keys: list, **kwargs) -> dict:
        """
        Load multiple data items from Redis.

        :param keys: List of keys for the data to be loaded.
        :return: Dictionary of key-value pairs.
        """
        async with self.client.pipeline() as pipe:
            for key in keys:
                await pipe.get(key)
            results = await pipe.execute()
        return {key: result.decode('utf-8') if result else None for key, result in zip(keys, results)}

    async def delete_batch_data(self, keys: list, **kwargs) -> None:
        """
        Delete multiple data items from Redis.

        :param keys: List of keys for the data to be deleted.
        """
        async with self.client.pipeline() as pipe:
            for key in keys:
                await pipe.delete(key)
            await pipe.execute()

    async def exists(self, key: str, **kwargs) -> bool:
        """
        Check if a key exists in Redis.

        :param key: The key to check for existence.
        :return: True if the key exists, False otherwise.
        """
        return await self.client.exists(key)

    async def list_keys(self, prefix: str = "*", **kwargs) -> list:
        """
        List keys in Redis matching a prefix.

        :param prefix: The prefix to match keys.
        :return: List of keys.
        """
        keys = await self.client.keys(prefix)
        return [key.decode('utf-8') for key in keys]
