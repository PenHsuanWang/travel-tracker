"""Request model for GIS map generation endpoints.

Defines the payload used to request a GIS map with optional filtering of
river features by name.
"""

from pydantic import BaseModel
from typing import Optional, List, Tuple


class GISMapRequest(BaseModel):
    """Payload for GIS map rendering.

    Attributes:
        layer: Tile layer key to render (see `MAP_LAYERS`).
        center: Optional (lat, lon) center for the map viewport.
        selected_rivers: Optional list of river names to include on the map.
    """
    layer: str
    center: Optional[Tuple[float, float]] = None  # e.g., (lat, lon)
    selected_rivers: Optional[List[str]] = None
