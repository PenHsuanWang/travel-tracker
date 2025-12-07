"""Map utility routes used by the frontend to request rendered maps and layers.

These endpoints are thin wrappers over :mod:`src.controllers.map_controller`.
"""

from fastapi import APIRouter
from src.controllers.map_controller import (
    get_layers,
    generate_map_endpoint,
    get_map_metadata
)
from src.models.map_request import MapRequest

router = APIRouter()

@router.get("/layers")
async def get_map_layers():
    return get_layers()

@router.post("/generate_map")
async def generate_map_route(request: MapRequest):
    return generate_map_endpoint(request.layer, request.center)

@router.get("/metadata")
async def map_metadata():
    return get_map_metadata()
