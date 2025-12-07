"""Async Redis storage adapter used for ephemeral key-value data.

This adapter provides an `aioredis`-backed implementation of the
`StorageAdapter` interface, suitable for caching or small ephemeral data
items.
"""

import aioredis
from typing import Any
from src.utils.dbbutler.storage_adapter import StorageAdapter


class RedisAdapter(StorageAdapter):
    """Async Redis adapter using `aioredis`.

    Args:
        host (str): Redis host.
        port (int): Redis port.
        db (int): Redis database index.
    """

    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0):
        self.client = aioredis.from_url(f"redis://{host}:{port}/{db}")

    async def save_data(self, key: str, value: str, **kwargs) -> None:
        """Store a string value under `key` in Redis."""
        await self.client.set(key, value)

    async def load_data(self, key: str, **kwargs) -> str:
        """Return the string value for `key`, or `None` when missing."""
        data = await self.client.get(key)
        return data.decode('utf-8') if data else None

    async def delete_data(self, key: str, **kwargs) -> None:
        """Delete `key` from Redis."""
        await self.client.delete(key)

    async def save_batch_data(self, data: dict, **kwargs) -> None:
        """Save multiple key/value pairs in a pipeline."""
        async with self.client.pipeline() as pipe:
            for key, value in data.items():
                await pipe.set(key, value)
            await pipe.execute()

    async def load_batch_data(self, keys: list, **kwargs) -> dict:
        """Load multiple keys and return a dict mapping key->value."""
        async with self.client.pipeline() as pipe:
            for key in keys:
                await pipe.get(key)
            results = await pipe.execute()
        return {key: result.decode('utf-8') if result else None for key, result in zip(keys, results)}

    async def delete_batch_data(self, keys: list, **kwargs) -> None:
        """Delete multiple keys in a pipeline."""
        async with self.client.pipeline() as pipe:
            for key in keys:
                await pipe.delete(key)
            await pipe.execute()

    async def exists(self, key: str, **kwargs) -> bool:
        """Return True if `key` exists in Redis."""
        return await self.client.exists(key)

    async def list_keys(self, prefix: str = "*", **kwargs) -> list:
        """Return keys matching `prefix` (glob-style)."""
        keys = await self.client.keys(prefix)
        return [key.decode('utf-8') for key in keys]
