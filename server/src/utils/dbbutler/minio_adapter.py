"""MinIO storage adapter implementation for the project's storage facade.

This adapter exposes the `StorageAdapter` interface and performs object
operations against a MinIO (S3-compatible) server.
"""

from minio import Minio
from minio.error import S3Error
from io import BytesIO
from src.utils.dbbutler.storage_adapter import StorageAdapter


class MinIOAdapter(StorageAdapter):
    """StorageAdapter implementation backed by MinIO.

    Args:
        endpoint (str): MinIO server URL (host:port or full URL).
        access_key (str): MinIO access key.
        secret_key (str): MinIO secret key.
        secure (bool): Use HTTPS if True.
    """

    def __init__(self, endpoint: str, access_key: str, secret_key: str, secure: bool = True):
        self.client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)

    def save_data(self, key: str, value: bytes, **kwargs) -> None:
        """Store `value` bytes in the named MinIO `bucket` under `key`."""
        bucket = kwargs.get('bucket')
        if not bucket:
            raise ValueError("Bucket name is required")

        if not isinstance(value, bytes):
            raise ValueError("Value must be bytes")

        try:
            value_stream = BytesIO(value)
            print("Trying to upload data to minio")
            self.client.put_object(bucket, key, value_stream, length=len(value))
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            raise
        except Exception as e:
            print(e)
            raise

    def load_data(self, key: str, **kwargs) -> bytes:
        """Retrieve raw bytes for `key` from the provided `bucket`."""
        bucket = kwargs.get('bucket')
        if not bucket:
            raise ValueError("Bucket name is required")

        try:
            response = self.client.get_object(bucket, key)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            raise

    def delete_data(self, key: str, **kwargs) -> None:
        """Remove the object identified by `key` from `bucket`."""
        bucket = kwargs.get('bucket')
        if not bucket:
            raise ValueError("Bucket name is required")

        try:
            self.client.remove_object(bucket, key)
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            raise

    def save_batch_data(self, data: dict, **kwargs) -> None:
        """Store multiple key->bytes pairs into `bucket`."""
        for key, value in data.items():
            self.save_data(key, value, **kwargs)

    def load_batch_data(self, keys: list, **kwargs) -> dict:
        """Retrieve multiple objects and return a dict mapping key->bytes."""
        return {key: self.load_data(key, **kwargs) for key in keys}

    def delete_batch_data(self, keys: list, **kwargs) -> None:
        """Delete multiple keys from `bucket`."""
        for key in keys:
            self.delete_data(key, **kwargs)

    def exists(self, key: str, **kwargs) -> bool:
        """Return True if `key` exists in `bucket`, False otherwise."""
        bucket = kwargs.get('bucket')
        if not bucket:
            raise ValueError("Bucket name is required")

        try:
            self.client.stat_object(bucket, key)
            return True
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            return False

    def list_keys(self, prefix: str = "", **kwargs) -> list:
        """List object names in `bucket` matching `prefix`."""
        bucket = kwargs.get('bucket')
        if not bucket:
            raise ValueError("Bucket name is required")

        try:
            objects = self.client.list_objects(bucket, prefix=prefix, recursive=True)
            return [obj.object_name for obj in objects]
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            raise
