# src/services/file_upload_service.py

from fastapi import UploadFile
from src.services.data_io_handlers.handler_factory import HandlerFactory


class FileUploadService:
    """
    Service to handle file uploads.
    """
    @classmethod
    def save_file(cls, file: UploadFile) -> str:
        """
        Save the uploaded file using the appropriate handler.

        :param file: The uploaded file.
        :return: The file path where the file is stored.
        """
        file_extension = file.filename.split('.')[-1]
        handler = HandlerFactory.get_handler(file_extension)
        return handler.handle(file)
