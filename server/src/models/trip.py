"""Trip domain models."""

from datetime import datetime, timezone
from typing import List, Optional
import uuid

from pydantic import BaseModel, Field
# We use a forward reference or conditional import to avoid circular dependency if user.py ever imports trip.py
# But for now it seems safe.
# Actually, to be safe, let's define UserSummary here or use a generic dict, 
# but importing is better for docs.
# Let's try importing.
try:
    from src.models.user import UserSummary
except ImportError:
    # Fallback if circular import happens (though it shouldn't)
    class UserSummary(BaseModel):
        id: str
        username: str
        avatar_url: Optional[str] = None

class TripStats(BaseModel):
    """Aggregated statistics derived from GPX analysis."""

    distance_km: float = 0.0
    elevation_gain_m: float = 0.0
    moving_time_sec: float = 0.0
    max_altitude_m: float = 0.0

class Trip(BaseModel):
    """Primary trip model backing CRUD APIs."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    region: Optional[str] = None
    notes: Optional[str] = None
    cover_photo_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    owner_id: Optional[str] = Field(default=None, index=True)
    member_ids: List[str] = Field(default_factory=list, index=True)
    is_public: bool = Field(default=True)
    stats: TripStats = Field(default_factory=TripStats)
    activity_start_date: Optional[datetime] = None
    activity_end_date: Optional[datetime] = None

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

class TripResponse(Trip):
    """Trip enriched with owner/member projections for API responses."""

    owner: Optional[UserSummary] = None
    members: List[UserSummary] = Field(default_factory=list)

class TripMembersUpdate(BaseModel):
    """Update payload for adding or removing trip members."""

    member_ids: List[str]

