from pydantic import BaseModel


class MapRequest(BaseModel):
    layer: str
