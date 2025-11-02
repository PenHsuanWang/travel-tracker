# src/services/handlers/csv_handler.py

from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory


class CSVHandler(BaseHandler):
    """
    Handler for CSV file uploads.
    """

    def __init__(self):
        self.storage_manager = StorageManager()
        
        # Use AdapterFactory for consistent initialization
        minio_adapter = AdapterFactory.create_minio_adapter()
        self.storage_manager.add_adapter('minio', minio_adapter)

    def handle(self, file: UploadFile) -> str:
        """
        Handle the uploaded CSV file.

        :param file: The uploaded CSV file.
        :return: The file path where the CSV file is stored.
        """
        file_data = file.file.read()
        file_name = file.filename
        bucket_name = 'uploadedfiles'

        # Save raw file data to MinIO
        self.storage_manager.save_data(file_name, file_data, adapter_name='minio', bucket=bucket_name)

        return f'{bucket_name}/{file_name}'
