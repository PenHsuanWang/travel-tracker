# src/routes/file_retrieval_routes.py

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Response, Query  # type: ignore[import-not-found]
from pydantic import BaseModel  # type: ignore[import-not-found]

from src.services.file_retrieval_service import FileRetrievalService

router = APIRouter()

retrieval_service = FileRetrievalService()


class FileListItem(BaseModel):
    object_key: str
    metadata_id: str
    bucket: str
    has_storage_object: bool
    has_metadata: bool
    metadata: Optional[Dict[str, Any]] = None
    warnings: List[str] = []

class GeotaggedImage(BaseModel):
    object_key: str
    original_filename: str
    lat: float
    lon: float
    thumb_url: str
    metadata_id: Optional[str] = None

@router.get("/list-files", response_model=List[str])
async def list_files(bucket: str = "gps-data"):
    """
    List object keys in the specified MinIO bucket.
    Defaults to 'gps-data'.
    """
    try:
        keys = retrieval_service.list_files(bucket)
        return keys
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list-files/detail", response_model=List[FileListItem])
async def list_files_with_metadata(bucket: str = "images", trip_id: Optional[str] = Query(None)):
    """List files alongside any metadata captured during upload."""
    try:
        return retrieval_service.list_files_with_metadata(bucket, trip_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/images/geo", response_model=List[GeotaggedImage])
async def get_geotagged_images(
    bucket: str = "images",
    minLon: Optional[float] = Query(None),
    minLat: Optional[float] = Query(None),
    maxLon: Optional[float] = Query(None),
    maxLat: Optional[float] = Query(None),
    trip_id: Optional[str] = Query(None)
):
    """
    Retrieve geotagged images (images with GPS coordinates).
    
    :param bucket: The bucket to query (default: 'images')
    :param minLon: Minimum longitude for bounding box filter
    :param minLat: Minimum latitude for bounding box filter
    :param maxLon: Maximum longitude for bounding box filter
    :param maxLat: Maximum latitude for bounding box filter
    :return: List of geotagged images with thumbnail URLs
    """
    try:
        bbox = None
        if all(v is not None for v in [minLon, minLat, maxLon, maxLat]):
            bbox = {
                'minLon': minLon,
                'minLat': minLat,
                'maxLon': maxLon,
                'maxLat': maxLat
            }
        
        return retrieval_service.list_geotagged_images(bucket, bbox, trip_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files/{filename}")
async def get_file(filename: str, bucket: str = "gps-data"):
    """
    Retrieve a file from MinIO by filename.
    Returns raw bytes with appropriate media type based on file extension.
    """
    file_bytes = retrieval_service.get_file_bytes(bucket, filename)
    if file_bytes is None:
        raise HTTPException(status_code=404, detail="File not found in MinIO")

    # Detect media type from filename extension
    import mimetypes
    media_type, _ = mimetypes.guess_type(filename)
    
    # Default to octet-stream if type cannot be determined
    if not media_type:
        media_type = "application/octet-stream"
    
    # Return raw bytes with proper media type
    return Response(content=file_bytes, media_type=media_type)
