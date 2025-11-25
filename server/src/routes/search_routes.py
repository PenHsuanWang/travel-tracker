from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from src.models.search import (
    SearchPresetCreateRequest,
    SearchPresetResponse,
    SearchPresetUpdateRequest,
    SearchRequest,
    SearchResponse,
)
from src.services.search_service import PhotoSearchService

router = APIRouter(prefix="/search", tags=["search"])
search_service = PhotoSearchService()


@router.post("/photos", response_model=SearchResponse)
async def search_photos(payload: SearchRequest) -> SearchResponse:
    try:
        return search_service.search_photos(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/presets", response_model=List[SearchPresetResponse])
async def list_search_presets(
    trip_id: str = Query(..., description="Trip identifier"),
    user_id: Optional[str] = Query(None, description="User identifier"),
) -> List[SearchPresetResponse]:
    try:
        return search_service.list_presets(trip_id, user_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/presets", response_model=SearchPresetResponse, status_code=201)
async def create_search_preset(payload: SearchPresetCreateRequest) -> SearchPresetResponse:
    try:
        return search_service.create_preset(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/presets/{preset_id}", response_model=SearchPresetResponse)
async def update_search_preset(preset_id: str, payload: SearchPresetUpdateRequest) -> SearchPresetResponse:
    try:
        return search_service.update_preset(preset_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/presets/{preset_id}")
async def delete_search_preset(preset_id: str) -> dict:
    try:
        deleted = search_service.delete_preset(preset_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Preset not found")
        return {"deleted": True}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
