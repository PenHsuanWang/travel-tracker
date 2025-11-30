# src/routes/file_upload_routes.py

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from src.controllers.file_upload_controller import FileUploadController
from src.models.trip import Trip
from src.auth import get_current_user
from src.models.user import User

router = APIRouter()


class UploadResponse(BaseModel):
    filename: str
    file_url: str
    metadata_id: Optional[str] = None
    size: Optional[int] = None
    mime_type: Optional[str] = None
    has_gps: Optional[bool] = None
    gps: Optional[Dict[str, Any]] = None
    date_taken: Optional[str] = None
    captured_at: Optional[str] = None
    captured_source: Optional[str] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    has_gpx_analysis: Optional[bool] = None
    analysis_status: Optional[str] = None
    analysis_bucket: Optional[str] = None
    analysis_object_key: Optional[str] = None
    analysis_error: Optional[str] = None
    track_summary: Optional[Dict[str, Any]] = None
    trip: Optional[Trip] = None
    gpx_metadata_extracted: Optional[bool] = None
    gpx_start_datetime: Optional[str] = None
    gpx_end_datetime: Optional[str] = None
    trip_dates_auto_filled: Optional[bool] = None
    auto_fill_reason: Optional[str] = None


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    uploader_id: Optional[str] = Query(None),
    trip_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file and return metadata including EXIF data for images.

    :param file: The uploaded file.
    :param uploader_id: Optional user ID.
    :param trip_id: Optional trip ID.
    :return: Upload response with file info and metadata.
    :raises HTTPException: If the file upload fails.
    """
    try:
        result = FileUploadController.upload_file(file, uploader_id, trip_id)
        
        # Handle legacy response format
        if "file_path" in result and "metadata_id" not in result:
            return {
                "filename": result.get("filename", file.filename),
                "file_url": result.get("file_path", "")
            }
        
        # Return enhanced response with metadata
        return {
            "filename": result.get("filename", file.filename),
            "file_url": result.get("file_path", ""),
            "metadata_id": result.get("metadata_id"),
            "size": result.get("size"),
            "mime_type": result.get("mime_type"),
            "has_gps": result.get("has_gps"),
            "gps": result.get("gps"),
            "date_taken": result.get("date_taken"),
            "captured_at": result.get("captured_at"),
            "captured_source": result.get("captured_source"),
            "camera_make": result.get("camera_make"),
            "camera_model": result.get("camera_model"),
            "has_gpx_analysis": result.get("has_gpx_analysis"),
            "analysis_status": result.get("analysis_status"),
            "analysis_bucket": result.get("analysis_bucket"),
            "analysis_object_key": result.get("analysis_object_key"),
            "analysis_error": result.get("analysis_error"),
            "track_summary": result.get("track_summary"),
            "trip": result.get("trip"),
            "gpx_metadata_extracted": result.get("gpx_metadata_extracted"),
            "gpx_start_datetime": result.get("gpx_start_datetime"),
            "gpx_end_datetime": result.get("gpx_end_datetime"),
            "trip_dates_auto_filled": result.get("trip_dates_auto_filled"),
            "auto_fill_reason": result.get("auto_fill_reason"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/metadata/{metadata_id:path}")
async def get_file_metadata(metadata_id: str):
    """
    Get metadata for an uploaded file.
    
    :param metadata_id: The metadata ID (object key).
    :return: File metadata.
    :raises HTTPException: If metadata not found.
    """
    try:
        metadata = FileUploadController.get_file_metadata(metadata_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Metadata not found")
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete/{filename:path}")
async def delete_file(filename: str, bucket: str = Query(default="images"), current_user: User = Depends(get_current_user)):
    """
    Delete an image file and its metadata.
    
    :param filename: The filename/object key to delete.
    :param bucket: The bucket name (default: images).
    :return: Success message.
    :raises HTTPException: If deletion fails.
    """
    try:
        result = FileUploadController.delete_file(filename, bucket)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
