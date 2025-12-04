"""User domain models consumed by authentication and community features."""

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

class User(BaseModel):
    """Represents an authenticated Travel Tracker account."""

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(
        default=None,
        description=(
            "String identifier kept for API compatibility. The persistence "
            "layer adapts ObjectIds before model construction."
        ),
    )
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None

    bio: Optional[str] = Field(default=None, max_length=500)
    location: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = None

    pinned_trip_ids: List[str] = Field(default_factory=list)

    total_distance_km: float = 0.0
    total_elevation_gain_m: float = 0.0
    total_trips: int = 0
    earned_badges: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSummary(BaseModel):
    """Lightweight projection used by the community grid."""
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    total_distance_km: float = 0.0
    total_trips: int = 0
    created_at: Optional[datetime] = None

class PublicUserProfile(BaseModel):
    """Publicly-visible profile served to other users."""
    id: str
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    
    # Stats & Gamification
    total_distance_km: float
    total_elevation_gain_m: float
    total_trips: int
    earned_badges: List[str]
    
    pinned_trips: List[dict] = Field(
        default_factory=list,
        description="Pinned trip summaries (dict to avoid circular import).",
    )

class UserInDB(User):
    """Extends :class:`User` with password storage details."""

    hashed_password: str

class UserCreate(User):
    """Data required to register a user."""

    password: str
    registration_key: str

class Token(BaseModel):
    """OAuth2 token issued after a successful login."""

    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Normalized token claims extracted from the JWT."""

    username: Optional[str] = None
