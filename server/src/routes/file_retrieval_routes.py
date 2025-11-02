# src/routes/file_retrieval_routes.py

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Response  # type: ignore[import-not-found]
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
async def list_files_with_metadata(bucket: str = "images"):
    """List files alongside any metadata captured during upload."""
    try:
        return retrieval_service.list_files_with_metadata(bucket)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/files/{filename}")
async def get_file(filename: str, bucket: str = "gps-data"):
    """
    Retrieve a file from MinIO by filename.
    Returns raw bytes as an 'application/octet-stream'.
    Adjust media_type if you know the file type (e.g., image/png, text/plain, etc.).
    """
    file_bytes = retrieval_service.get_file_bytes(bucket, filename)
    if file_bytes is None:
        raise HTTPException(status_code=404, detail="File not found in MinIO")

    # Return raw bytes as a generic binary stream.
    return Response(content=file_bytes, media_type="application/octet-stream")
