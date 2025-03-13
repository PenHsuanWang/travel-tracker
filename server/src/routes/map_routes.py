# server/src/routes/map_routes.py

from fastapi import APIRouter
from src.controllers.map_controller import (
    get_layers,
    generate_map,
    get_map_metadata
)
from src.models.map_request import MapRequest

router = APIRouter()

@router.get("/layers")
async def get_map_layers():
    """
    Returns a list of available map layers from the controller.
    """
    return get_layers()

@router.post("/generate_map")
async def generate_map_endpoint(request: MapRequest):
    """
    request.layer: e.g. 'openstreetmap'
    request.center: e.g. (lat, lon) or None
    Returns the Folium-generated map HTML as a string.
    """
    return generate_map(layer=request.layer, center=request.center)

@router.get("/metadata")
async def map_metadata():
    """
    Returns additional metadata about the map (layers, default center).
    This is strictly JSON (no HTML).
    """
    return get_map_metadata()
