# src/services/file_upload_service.py

from fastapi import HTTPException, UploadFile  # type: ignore[import-not-found]
from src.services.data_io_handlers.handler_factory import HandlerFactory
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.models.file_metadata import HandlerResult, FileMetadata
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging


class FileUploadService:
    """
    Service to handle file uploads and metadata persistence.
    """
    
    def __init__(self):
        self.storage_manager = StorageManager()
        # Initialize MongoDB adapter for metadata storage
        mongodb_adapter = AdapterFactory.create_mongodb_adapter()
        self.storage_manager.add_adapter('mongodb', mongodb_adapter)

        # Try to initialize MinIO adapter as well so operations like delete
        # can access the object storage. In some dev setups MinIO creds may
        # not be configured, so we catch and log the error instead of failing
        # service initialization.
        try:
            minio_adapter = AdapterFactory.create_minio_adapter()
            self.storage_manager.add_adapter('minio', minio_adapter)
        except Exception as e:
            logging.getLogger(__name__).warning(f"MinIO adapter not initialized: {e}")
    
    @classmethod
    def save_file(cls, file: UploadFile, uploader_id: Optional[str] = None, trip_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Save the uploaded file using the appropriate handler and persist metadata.

        :param file: The uploaded file.
        :param uploader_id: Optional ID of the user uploading the file.
        :param trip_id: Optional ID of the trip this file belongs to.
        :return: Dictionary containing file info and metadata.
        """
        service = cls()
        file_extension = file.filename.split('.')[-1].lower()
        handler = HandlerFactory.get_handler(file_extension)
        
        result = handler.handle(file, trip_id=trip_id)
        
        # Handle legacy handlers that return strings
        if isinstance(result, str):
            return {
                "file_path": result,
                "filename": file.filename,
                "status": "success"
            }
        
        # Handle new HandlerResult with metadata
        if isinstance(result, HandlerResult):
            # Save metadata to MongoDB
            metadata_id = result.object_key
            metadata = FileMetadata(
                id=metadata_id,
                object_key=result.object_key,
                bucket=result.bucket,
                filename=result.filename,
                original_filename=result.original_filename,
                size=result.size,
                mime_type=result.mime_type,
                file_extension=result.file_extension,
                exif=result.exif,
                gps=result.gps,
                date_taken=result.date_taken,
                captured_at=result.captured_at,
                captured_source=result.captured_source,
                camera_make=result.camera_make,
                camera_model=result.camera_model,
                created_at=datetime.now(timezone.utc),
                uploader_id=uploader_id,
                trip_id=trip_id,
                status=result.status
            )
            
            # Save to MongoDB
            service.storage_manager.save_data(
                metadata_id,
                metadata.model_dump(by_alias=True),
                adapter_name='mongodb',
                collection_name='file_metadata'
            )
            
            return {
                "metadata_id": metadata_id,
                "object_key": result.object_key,
                "filename": result.original_filename,
                "file_path": f"{result.bucket}/{result.filename}",
                "size": result.size,
                "mime_type": result.mime_type,
                "has_gps": result.gps is not None,
                "gps": result.gps.model_dump() if result.gps else None,
                "date_taken": result.date_taken,
                "captured_at": result.captured_at.isoformat() if result.captured_at else None,
                "captured_source": result.captured_source,
                "camera_make": result.camera_make,
                "camera_model": result.camera_model,
                "status": result.status
            }
        
        return {
            "filename": file.filename,
            "status": "unknown",
            "error": "Unexpected handler result type"
        }
    
    @classmethod
    def get_file_metadata(cls, metadata_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve metadata for a file.
        
        :param metadata_id: The metadata ID (object key).
        :return: File metadata or None.
        """
        service = cls()
        metadata = service.storage_manager.load_data(
            'mongodb',
            metadata_id,
            collection_name='file_metadata'
        )
        return metadata
    
    @classmethod
    def delete_file(cls, filename: str, bucket: str = "images") -> Dict[str, Any]:
        """
        Delete a file from storage and its metadata from database.
        
        :param filename: The filename/object key to delete.
        :param bucket: The bucket name.
        :return: Success message with details.
        """
        service = cls()
        deleted_items = []
        errors = []
        metadata_snapshot: Optional[Dict[str, Any]] = None
        
        # Delete from MinIO
        try:
            minio_adapter = service.storage_manager.adapters.get('minio')
            if minio_adapter:
                # Check if file exists
                if minio_adapter.exists(filename, bucket=bucket):
                    minio_adapter.delete_data(filename, bucket=bucket)
                    deleted_items.append(f"MinIO: {bucket}/{filename}")
                else:
                    errors.append(f"File not found in MinIO: {bucket}/{filename}")
            else:
                errors.append("MinIO adapter not available")
        except Exception as e:
            errors.append(f"MinIO deletion error: {str(e)}")
        
        # Capture metadata before deletion and remove stored document
        try:
            mongodb_adapter = service.storage_manager.adapters.get('mongodb')
            if mongodb_adapter:
                try:
                    snapshot_raw = mongodb_adapter.load_data(
                        filename,
                        collection_name='file_metadata'
                    )
                except Exception as exc:
                    snapshot_raw = None
                    errors.append(f"MongoDB metadata read error: {str(exc)}")

                if snapshot_raw:
                    try:
                        parsed_metadata = FileMetadata(**snapshot_raw)
                        metadata_snapshot = parsed_metadata.model_dump()
                        metadata_snapshot['created_at'] = parsed_metadata.created_at.isoformat()
                    except Exception as exc:
                        metadata_snapshot = snapshot_raw
                        created_at = metadata_snapshot.get('created_at')
                        if isinstance(created_at, datetime):
                            metadata_snapshot['created_at'] = created_at.isoformat()
                        errors.append(f"Metadata parsing warning: {str(exc)}")

                delete_success = mongodb_adapter.delete_data(
                    filename,
                    collection_name='file_metadata'
                )
                if delete_success:
                    deleted_items.append(f"MongoDB: file_metadata/{filename}")
        except Exception as e:
            # MongoDB is optional, log error but don't fail
            errors.append(f"MongoDB deletion error: {str(e)}")
        
        if deleted_items:
            result = {
                "success": True,
                "message": "File deleted successfully",
                "filename": filename,
                "bucket": bucket,
                "deleted": deleted_items,
                "metadata": metadata_snapshot
            }
            if errors:
                result["warnings"] = errors
            return result
        else:
            raise HTTPException(
                status_code=404,
                detail={
                    "message": "File not found or deletion failed",
                    "filename": filename,
                    "bucket": bucket,
                    "errors": errors
                }
            )
