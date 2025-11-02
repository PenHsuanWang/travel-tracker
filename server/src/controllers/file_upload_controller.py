# src/controllers/file_upload_controller.py

from fastapi import UploadFile, HTTPException
from src.services.file_upload_service import FileUploadService
from typing import Dict, Any, Optional


class FileUploadController:
    """
    Controller for file uploads.
    """
    @staticmethod
    def upload_file(file: UploadFile, uploader_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload the file and return metadata.

        :param file: The uploaded file.
        :param uploader_id: Optional user ID.
        :return: Dictionary containing file info and metadata.
        """
        return FileUploadService.save_file(file, uploader_id)
    
    @staticmethod
    def get_file_metadata(metadata_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a file.
        
        :param metadata_id: The metadata ID.
        :return: File metadata or None.
        """
        return FileUploadService.get_file_metadata(metadata_id)
    
    @staticmethod
    def delete_file(filename: str, bucket: str = "images") -> Dict[str, Any]:
        """
        Delete a file and its metadata.
        
        :param filename: The filename/object key to delete.
        :param bucket: The bucket name.
        :return: Success message.
        :raises HTTPException: If deletion fails.
        """
        return FileUploadService.delete_file(filename, bucket)
