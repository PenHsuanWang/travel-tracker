# src/services/handlers/csv_handler.py

from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager
# from src.utils.file_analysis import process_csv


class CSVHandler(BaseHandler):
    """
    Handler for CSV file uploads.
    """

    def __init__(self):
        self.storage_manager = StorageManager()

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

        # Process the CSV file
        data = process_csv(file_data)

        # Save processed CSV data to MongoDB
        self.storage_manager.save_data(file_name, data, adapter_name='mongodb', collection_name='csv_data')

        metadata = {'name': file_name, 'file_path': f'{bucket_name}/{file_name}'}

        # Save metadata to MongoDB
        self.storage_manager.save_data(file_name, metadata, adapter_name='mongodb', collection_name='metadata')

        return f'{bucket_name}/{file_name}'
