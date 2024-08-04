# utils/minio_adapter.py

from minio import Minio
from minio.error import S3Error
from io import BytesIO
from src.utils.dbbutler.storage_adapter import StorageAdapter


class MinIOAdapter(StorageAdapter):
    def __init__(self, endpoint: str, access_key: str, secret_key: str, secure: bool = True):
        """
        Initialize the MinIO client.

        :param endpoint: MinIO server URL.
        :param access_key: Access key for MinIO.
        :param secret_key: Secret key for MinIO.
        :param secure: Flag to indicate if the connection is secure (HTTPS).
        """
        self.client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)

    def save_data(self, key: str, value: bytes, bucket: str):
        """
        Store data in MinIO bucket.

        :param key: The object name under which the data should be stored.
        :param value: The data to store. It must be bytes.
        :param bucket: The name of the bucket.
        """
        if not isinstance(value, bytes):
            raise ValueError("Value must be bytes")

        try:
            value_stream = BytesIO(value)
            self.client.put_object(bucket, key, value_stream, length=len(value))
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            raise

    def load_data(self, key: str, bucket: str) -> bytes:
        """
        Retrieve data from MinIO bucket.

        :param key: The object name of the data to retrieve.
        :param bucket: The name of the bucket.
        :return: The data as bytes.
        """
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

    def delete_data(self, key: str, bucket: str) -> bool:
        """
        Delete data from MinIO bucket.

        :param key: The object name of the data to delete.
        :param bucket: The name of the bucket.
        :return: True if deletion was successful, False otherwise.
        """
        try:
            self.client.remove_object(bucket, key)
            return True
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            return False

    def save_batch_data(self, data: dict, bucket: str) -> None:
        """
        Store multiple data items in MinIO bucket.

        :param data: Dictionary of key-value pairs to be stored.
        :param bucket: The name of the bucket.
        """
        for key, value in data.items():
            self.save_data(key, value, bucket)

    def load_batch_data(self, keys: list, bucket: str) -> dict:
        """
        Retrieve multiple data items from MinIO bucket.

        :param keys: List of keys for the data to be loaded.
        :param bucket: The name of the bucket.
        :return: Dictionary of key-value pairs.
        """
        return {key: self.load_data(key, bucket) for key in keys}

    def delete_batch_data(self, keys: list, bucket: str) -> None:
        """
        Delete multiple data items from MinIO bucket.

        :param keys: List of keys for the data to be deleted.
        :param bucket: The name of the bucket.
        """
        for key in keys:
            self.delete_data(key, bucket)

    def exists(self, key: str, bucket: str) -> bool:
        """
        Check if an object exists in MinIO bucket.

        :param key: The object name to check.
        :param bucket: The name of the bucket.
        :return: True if the object exists, False otherwise.
        """
        try:
            self.client.stat_object(bucket, key)
            return True
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            return False

    def list_keys(self, bucket: str, prefix: str = "") -> list:
        """
        Retrieve a list of object names from MinIO bucket matching a prefix.

        :param bucket: The name of the bucket.
        :param prefix: The prefix to match.
        :return: A list of object names.
        """
        try:
            objects = self.client.list_objects(bucket, prefix=prefix, recursive=True)
            return [obj.object_name for obj in objects]
        except S3Error as e:
            if e.code == 'NoSuchBucket':
                raise ValueError(f"Bucket '{bucket}' does not exist")
            raise

