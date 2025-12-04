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
    return get_river_names()

@router.post("/generate_gis_map")
async def generate_gis_map_endpoint(request: GISMapRequest):
    return generate_gis_map(request.layer, request.center, request.selected_rivers)

@router.get("/rivers_data")
async def rivers_data():
    """
    Return the entire dictionary of {riverName: geojsonObject}, 
    but now it's cached + simplified. 
    """
    return get_river_data_as_geojson()
