"""User-related Pydantic models used across the application.

The module defines full user models, lightweight summaries for listing
users, and DTOs used during registration and authentication flows.
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class User(BaseModel):
    """Primary user model used for API request/response payloads.

    The database layer may convert MongoDB ObjectId values to strings
    before constructing this model; thus the `id` field is a plain
    optional string for API compatibility.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default=None)
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    
    # Profile fields
    bio: Optional[str] = Field(default=None, max_length=500)
    location: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = None
    
    # Social / Display
    pinned_trip_ids: List[str] = []
    
    # Gamification
    total_distance_km: float = 0.0
    total_elevation_gain_m: float = 0.0
    total_trips: int = 0
    earned_badges: List[str] = []
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserSummary(BaseModel):
    """Lightweight model for user lists and summaries."""
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    total_distance_km: float = 0.0
    total_trips: int = 0
    created_at: Optional[datetime] = None


class PublicUserProfile(BaseModel):
    """Public profile representation returned by profile endpoints."""
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
    
    # Content
    pinned_trips: List[dict] = []


class UserInDB(User):
    """Internal model including DB-only fields like hashed password."""
    hashed_password: str


class UserCreate(User):
    """Payload used to register a new user."""
    password: str
    registration_key: str


class Token(BaseModel):
    """JWT token response model."""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Token payload data used during token validation."""
    username: Optional[str] = None
