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
    """
    List river names from the GIS pickle file stored in MinIO (bucket: gis-data).
    """
    try:
        return get_river_names()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate_gis_map")
async def generate_gis_map_endpoint(request: GISMapRequest):
    """
    Generate a map with GIS overlays (rivers) based on selected river names.
    Returns Folium HTML.
    """
    try:
        html = generate_gis_map(
            layer=request.layer,
            center=request.center,
            selected_rivers=request.selected_rivers
        )
        return html
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rivers_data")
async def rivers_data():
    """
    Return raw river geometry data as GeoJSON (no HTML),
    so the front end can toggle overlays on the existing Leaflet map.
    """
    try:
        return get_river_data_as_geojson()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
