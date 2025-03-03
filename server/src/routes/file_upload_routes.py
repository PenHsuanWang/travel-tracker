# src/routes/file_upload_routes.py

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from src.controllers.file_upload_controller import FileUploadController

router = APIRouter()


class UploadResponse(BaseModel):
    filename: str
    file_url: str


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file and return the file path.

    :param file: The uploaded file.
    :return: The file path where the file is stored.
    :raises HTTPException: If the file upload fails.
    """
    try:
        file_url = FileUploadController.upload_file(file)
        return {"filename": file.filename, "file_url": file_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
