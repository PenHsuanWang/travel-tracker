# src/controllers/file_upload_controller.py

from fastapi import UploadFile
from src.services.file_upload_service import FileUploadService


class FileUploadController:
    """
    Controller for file uploads.
    """
    @staticmethod
    def upload_file(file: UploadFile) -> str:
        """
        Upload the file and return the file path.

        :param file: The uploaded file.
        :return: The file path where the file is stored.
        """
        return FileUploadService.save_file(file)
