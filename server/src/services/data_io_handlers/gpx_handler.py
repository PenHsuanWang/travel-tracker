# src/services/data_io_handlers/gpx_handler.py

from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.file_analysis import analyze_file


class GPXHandler(BaseHandler):
    """
    Handler for GPX file uploads.
    """

    def __init__(self):
        self.storage_manager = StorageManager()

    def handle(self, file: UploadFile) -> str:
        """
        Handle the uploaded GPX file.

        :param file: The uploaded GPX file.
        :return: The file path where the GPX file is stored.
        """
        file_data = file.file.read()
        file_name = file.filename
        file_extension = file_name.split('.')[-1]
        bucket_name = 'gpx_tracks'

        # Save raw file data to MinIO
        self.storage_manager.save_data(file_name, file_data, adapter_name='mongodb', collection=f"{bucket_name}_raw")

        # Analyze the GPX file
        analysis = analyze_file(file_data, file_extension)
        metadata = {
            'name': file_name,
            'file_path': f'{bucket_name}/{file_name}',
            **analysis
        }

        # Save metadata to MongoDB
        self.storage_manager.save_data(file_name, metadata, adapter_name='mongodb', collection_name='metadata')

        # Save parsed GPX data to MongoDB
        self.storage_manager.save_data(file_name, analysis, adapter_name='mongodb', collection=f"{bucket_name}_analyzed")

        return f'{bucket_name}/{file_name}'
