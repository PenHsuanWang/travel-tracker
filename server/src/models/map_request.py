"""Legacy map rendering request payloads."""

from typing import Optional, Tuple

from pydantic import BaseModel


class MapRequest(BaseModel):
    """Parameters accepted by old map-rendering endpoints."""

    layer: str
    center: Optional[Tuple[float, float]] = None
