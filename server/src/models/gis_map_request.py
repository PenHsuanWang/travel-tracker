# server/src/models/gis_map_request.py
from pydantic import BaseModel
from typing import Optional, List, Tuple

class GISMapRequest(BaseModel):
    layer: str
    center: Optional[Tuple[float, float]] = None  # e.g., (lat, lon)
    selected_rivers: Optional[List[str]] = None
