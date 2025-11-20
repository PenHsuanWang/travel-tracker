# src/models/file_metadata.py

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class GPSData(BaseModel):
    """GPS coordinates and metadata"""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    latitude_ref: Optional[str] = None
    longitude_ref: Optional[str] = None


class FileMetadata(BaseModel):
    """Metadata for uploaded files"""
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
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    uploader_id: Optional[str] = None
    trip_id: Optional[str] = None
    status: str = "active"
    
    class Config:
        populate_by_name = True


class HandlerResult(BaseModel):
    """Result returned by file handlers"""
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
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    trip_id: Optional[str] = None
    status: str = "success"
    error: Optional[str] = None
