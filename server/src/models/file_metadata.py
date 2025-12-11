"""Pydantic models and schemas for file metadata and handler results.

These models represent persisted file metadata records and the lightweight
payload returned by file handler implementations.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone


class GPSData(BaseModel):
    """GPS coordinates and auxiliary tags extracted from image EXIF."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    latitude_ref: Optional[str] = None
    longitude_ref: Optional[str] = None


class FileMetadata(BaseModel):
    """Metadata for uploaded files, stored in the `file_metadata` collection.

    This model represents the full metadata document for any file uploaded to the
    system, linking it to trips and users.

    Attributes:
        id: The unique identifier for the metadata object (maps to `_id`).
        object_key: The key of the file in the MinIO bucket.
        bucket: The MinIO bucket where the file is stored.
        filename: The name of the file.
        original_filename: The original name of the file from the user's system.
        size: The size of the file in bytes.
        mime_type: The MIME type of the file.
        file_extension: The file's extension.
        exif: Raw EXIF data extracted from the file.
        gps: GPS data extracted from EXIF.
        date_taken: The date the photo was taken (string format).
        captured_at: The UTC datetime the photo was taken.
        captured_source: The source of the capture timestamp.
        camera_make: The make of the camera used.
        camera_model: The model of the camera used.
        created_at: The UTC datetime when the metadata was created.
        uploader_id: The ID of the user who uploaded the file. This field should
                     be indexed in MongoDB for efficient querying.
        trip_id: The ID of the trip this file belongs to.
        has_gpx_analysis: Flag indicating if GPX analysis was performed.
        analysis_object_key: The object key for the GPX analysis data.
        analysis_bucket: The bucket for the GPX analysis data.
        analysis_status: The status of the GPX analysis.
        analysis_error: Any error message from a failed analysis.
        track_summary: A summary of the GPX track data.
        status: The status of the file (e.g., 'active', 'deleted').
        note: A user-provided note for the file.
        note_title: A title for the user-provided note.
        order_index: An index for manual sorting of files.
        waypoint_overrides: User-defined overrides for waypoints.
    """
    id: str = Field(..., alias='_id')
    object_key: str
    bucket: str
    filename: str
    original_filename: str
    size: int
    mime_type: str
    file_extension: str
    exif: Optional[Dict[str, Any]] = None
    gps: Optional[GPSData] = None
    date_taken: Optional[str] = None
    captured_at: Optional[datetime] = None
    captured_source: Optional[str] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    uploader_id: Optional[str] = None
    trip_id: Optional[str] = None
    has_gpx_analysis: Optional[bool] = None
    analysis_object_key: Optional[str] = None
    analysis_bucket: Optional[str] = None
    analysis_status: Optional[str] = None  # 'success', 'failed', 'not_attempted'
    analysis_error: Optional[str] = None
    track_summary: Optional[Dict[str, Any]] = None
    status: str = "active"
    note: Optional[str] = None
    note_title: Optional[str] = None
    order_index: Optional[int] = None
    waypoint_overrides: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class FileMetadataResponse(FileMetadata):
    """Response model for file metadata including computed permission fields.

    This model extends the base `FileMetadata` to include fields that are
    computed on-the-fly based on the requesting user's permissions, such as
    whether they are allowed to delete the file.

    Attributes:
        can_delete: A boolean indicating if the current user has permission
                    to delete this file. This is computed by the backend and
                    not stored in the database.
    """
    can_delete: bool = False



class HandlerResult(BaseModel):
    """Result returned by file handlers used during upload processing.

    The handler result is a compact representation of the stored object and
    any analysis status produced by post-processing hooks.
    """
    object_key: str
    bucket: str
    filename: str
    original_filename: str
    size: int
    mime_type: str
    file_extension: str
    exif: Optional[Dict[str, Any]] = None
    gps: Optional[GPSData] = None
    date_taken: Optional[str] = None
    captured_at: Optional[datetime] = None
    captured_source: Optional[str] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    trip_id: Optional[str] = None
    status: str = "success"
    error: Optional[str] = None
    has_gpx_analysis: Optional[bool] = None
    analysis_object_key: Optional[str] = None
    analysis_bucket: Optional[str] = None
    analysis_status: Optional[str] = None
    analysis_error: Optional[str] = None
    track_summary: Optional[Dict[str, Any]] = None
