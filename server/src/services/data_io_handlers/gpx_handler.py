from typing import Optional
from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.models.file_metadata import HandlerResult


class GPXHandler(BaseHandler):
    """
    Handler for GPX file uploads.
    """

    def __init__(self):
        self.storage_manager = StorageManager()

        # Use AdapterFactory for consistent initialization
        minio_adapter = AdapterFactory.create_minio_adapter()
        self.storage_manager.add_adapter('minio', minio_adapter)

    def handle(self, file: UploadFile, trip_id: Optional[str] = None) -> HandlerResult:
        """
        Handle the uploaded GPX file.

        :param file: The uploaded GPX file.
        :param trip_id: Optional ID of the trip this file belongs to.
        :return: HandlerResult containing file info.
        """
        file_data = file.file.read()
        file_name = file.filename
        file_extension = file_name.split('.')[-1].lower()
        bucket_name = 'gps-data'

        print("gpx handler been invoked")

        # Save raw GPX file data to MinIO using the 'minio' adapter and the bucket 'gps-data'
        self.storage_manager.save_data(file_name, file_data, adapter_name='minio', bucket=bucket_name)

        # Return HandlerResult so FileUploadService can save metadata
        return HandlerResult(
            object_key=file_name,
            bucket=bucket_name,
            filename=file_name,
            original_filename=file_name,
            size=len(file_data),
            mime_type='application/gpx+xml',
            file_extension=file_extension,
            trip_id=trip_id,
            status='success'
        )
