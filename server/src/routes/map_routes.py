from fastapi import APIRouter
from src.controllers.map_controller import get_layers, generate_map
from src.models.map_request import MapRequest

router = APIRouter()


@router.get("/layers")
async def get_map_layers():
    return get_layers()


@router.post("/generate_map")
async def generate_map_endpoint(request: MapRequest):
    return generate_map(request.layer)
