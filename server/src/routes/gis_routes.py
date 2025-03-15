# server/src/routes/gis_routes.py
from fastapi import APIRouter, HTTPException
from typing import List
from src.controllers.map_controller import get_river_names, generate_gis_map
from src.models.gis_map_request import GISMapRequest

router = APIRouter()

@router.get("/list_rivers", response_model=List[str])
async def list_rivers():
    """
    List river names from the GIS pickle file stored in MinIO (bucket: gis-data).
    """
    try:
        rivers = get_river_names()
        return rivers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate_gis_map")
async def generate_gis_map_endpoint(request: GISMapRequest):
    """
    Generate a map with GIS overlays (rivers) based on selected river names.
    """
    try:
        html = generate_gis_map(layer=request.layer, center=request.center, selected_rivers=request.selected_rivers)
        return html
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
