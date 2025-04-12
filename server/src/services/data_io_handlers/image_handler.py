# src/services/handlers/image_handler.py

from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager


class ImageHandler(BaseHandler):
    """
    Handler for image file uploads.
    """

    def __init__(self):
        self.storage_manager = StorageManager()

    def handle(self, file: UploadFile) -> str:
        """
        Handle the uploaded image file.

        :param file: The uploaded image file.
        :return: The file path where the image file is stored.
        """
        file_data = file.file.read()
        file_name = file.filename
        bucket_name = 'images'

        # Save raw file data to MinIO
        self.storage_manager.save_data(file_name, file_data, adapter_name='minio', bucket=bucket_name)

        metadata = {'name': file_name, 'file_path': f'{bucket_name}/{file_name}'}

        # Save metadata to MongoDB
        self.storage_manager.save_data(file_name, metadata, adapter_name='mongodb', collection_name='metadata')

        return f'{bucket_name}/{file_name}'
