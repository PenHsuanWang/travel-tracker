# server/src/routes/map_routes.py
from fastapi import APIRouter
from src.controllers.map_controller import get_layers, generate_map
from src.models.map_request import MapRequest

router = APIRouter()


@router.get("/layers")
async def get_map_layers():
    return get_layers()


@router.post("/generate_map")
async def generate_map_endpoint(request: MapRequest):
    """
    request.layer: e.g. 'openstreetmap'
    request.center: e.g. (lat, lon) or None
    """
    return generate_map(layer=request.layer, center=request.center)
