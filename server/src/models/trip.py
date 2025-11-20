from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    region: Optional[str] = None
    notes: Optional[str] = None
    cover_photo_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Yushan 3-day hike",
                "start_date": "2024-10-01T08:00:00",
                "end_date": "2024-10-03T18:00:00",
                "region": "Taiwan",
                "notes": "Beautiful weather, tough climb.",
                "created_at": "2024-09-30T10:00:00"
            }
        }
