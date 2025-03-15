# server/src/routes/gis_routes.py

from fastapi import APIRouter, HTTPException
from typing import List
from src.controllers.map_controller import (
    get_river_names,
    generate_gis_map,
    get_river_data_as_geojson
)
from src.models.gis_map_request import GISMapRequest

router = APIRouter()

@router.get("/list_rivers", response_model=List[str])
async def list_rivers():
    try:
        return get_river_names()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate_gis_map")
async def generate_gis_map_endpoint(request: GISMapRequest):
    try:
        return generate_gis_map(request.layer, request.center, request.selected_rivers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rivers_data")
async def rivers_data():
    """
    Return the entire dictionary of {riverName: geojsonObject}, 
    but now it's cached + simplified. 
    """
    try:
        return get_river_data_as_geojson()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
