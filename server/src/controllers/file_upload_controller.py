"""Controller layer for file upload operations.

This controller provides thin wrappers around :class:`FileUploadService` and
is primarily responsible for adapting FastAPI upload primitives to the
service layer. All methods delegate to the underlying service and do not
perform business logic.
"""

from fastapi import UploadFile, HTTPException
from src.services.file_upload_service import FileUploadService
from typing import Dict, Any, Optional


class FileUploadController:
    """Facade exposing file upload operations to the routing layer.

    Methods are intentionally small and delegate to :class:`FileUploadService`.
    """

    @staticmethod
    def upload_file(
        file: UploadFile,
        uploader_id: Optional[str] = None,
        trip_id: Optional[str] = None,
        plan_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upload a file and return metadata.

        Args:
            file (UploadFile): The uploaded file object.
            uploader_id (Optional[str]): Optional uploader user id.
            trip_id (Optional[str]): Optional trip id to associate the file.
            plan_id (Optional[str]): Optional plan id to associate the file.

        Returns:
            Dict[str, Any]: Metadata and analysis results produced by the handler.
        """
        return FileUploadService.save_file(file, uploader_id, trip_id, plan_id)

    @staticmethod
    def get_file_metadata(metadata_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve file metadata by metadata id.

        Args:
            metadata_id (str): The metadata document id / object key.

        Returns:
            Optional[Dict[str, Any]]: Metadata document or ``None`` if missing.
        """
        return FileUploadService.get_file_metadata(metadata_id)

    @staticmethod
    def delete_file(filename: str, bucket: str = "images") -> Dict[str, Any]:
        """Delete a file and its metadata.

        Args:
            filename (str): Object key / metadata id to delete.
            bucket (str): MinIO bucket name (default: ``"images"``).

        Returns:
            Dict[str, Any]: Summary of deletion results.

        Raises:
            HTTPException: Raised when deletion fails or resource not found.
        """
        return FileUploadService.delete_file(filename, bucket)
