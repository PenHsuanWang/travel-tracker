"""Request model for map rendering endpoints.

This module defines a small request schema used by the mapping endpoints
to request a specific tile `layer` and optional `center` coordinates.
"""

from pydantic import BaseModel
from typing import Optional, Tuple


class MapRequest(BaseModel):
    """Payload for map generation requests.

    Attributes:
        layer: Key identifying the tile layer to use (matches `MAP_LAYERS`).
        center: Optional (lat, lon) tuple to center the map viewport.
    """
    layer: str
    center: Optional[Tuple[float, float]] = None  # (latitude, longitude)
