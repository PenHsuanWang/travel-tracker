"""Handler implementation for CSV uploads."""

from __future__ import annotations

from fastapi import UploadFile

from src.services.data_io_handlers.base_handler import BaseHandler
from src.services.service_dependencies import ensure_storage_manager
from src.utils.dbbutler.storage_manager import StorageManager


class CSVHandler(BaseHandler):
    """Persist CSV files directly into object storage."""

    def __init__(self, storage_manager: StorageManager | None = None) -> None:
        self.storage_manager = ensure_storage_manager(storage_manager, include_minio=True)

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
