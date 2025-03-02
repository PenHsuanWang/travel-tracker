# server/src/models/map_request.py
from pydantic import BaseModel
from typing import Optional

class MapRequest(BaseModel):
    layer: str
    center: Optional[tuple[float, float]] = None  # (latitude, longitude)
