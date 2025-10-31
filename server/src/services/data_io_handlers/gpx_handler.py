# src/services/data_io_handlers/gpx_handler.py

import os
from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.dbbutler.minio_adapter import MinIOAdapter
from dotenv import load_dotenv

load_dotenv()


class GPXHandler(BaseHandler):
    """
    Handler for GPX file uploads.
    """

    def __init__(self):
        self.storage_manager = StorageManager()

        minio_adapter = MinIOAdapter(
            endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=os.getenv("MINIO_SECURE", "False").lower() == "true"
        )
        self.storage_manager.add_adapter('minio', minio_adapter)

    def handle(self, file: UploadFile) -> str:
        """
        Handle the uploaded GPX file.

        :param file: The uploaded GPX file.
        :return: The file path where the GPX file is stored.
        """
        file_data = file.file.read()
        file_name = file.filename
        file_extension = file_name.split('.')[-1]
        bucket_name = 'gps-data'

        print("gpx handler been invoked")

        # Save raw GPX file data to MinIO using the 'minio' adapter and the bucket 'gps-data'
        self.storage_manager.save_data(file_name, file_data, adapter_name='minio', bucket=bucket_name)

        # If you later want to process or analyze the GPX file, you can uncomment and update the code below.
        # analysis = analyze_file(file_data, file_extension)
        # metadata = {
        #     'name': file_name,
        #     'file_path': f'{bucket_name}/{file_name}',
        #     **analysis
        # }
        #
        # # Optionally, save metadata to MongoDB
        # self.storage_manager.save_data(file_name, metadata, adapter_name='mongodb', collection_name='metadata')
        #
        # # Optionally, save parsed GPX data to MongoDB
        # self.storage_manager.save_data(file_name, analysis, adapter_name='mongodb', collection=f"{bucket_name}_analyzed")

        return f'{bucket_name}/{file_name}'
