"""GIS map payloads for the legacy server-rendered flow."""

from typing import List, Optional, Tuple

from pydantic import BaseModel


class GISMapRequest(BaseModel):
    """Subset of controls needed by the GIS endpoints."""

    layer: str
    center: Optional[Tuple[float, float]] = None
    selected_rivers: Optional[List[str]] = None
