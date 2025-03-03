# src/routes/file_retrieval_routes.py

from fastapi import APIRouter, HTTPException, Response
from typing import List
from src.services.file_retrieval_service import FileRetrievalService

router = APIRouter()

retrieval_service = FileRetrievalService()

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
