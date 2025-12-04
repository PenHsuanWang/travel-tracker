from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Use plain `id` field (string) for API compatibility. Database layer will
    # convert ObjectId to string before constructing models.
    id: Optional[str] = Field(default=None)
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    
    # New Fields
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
    """Lightweight model for the Community Grid"""
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    total_distance_km: float = 0.0
    total_trips: int = 0
    created_at: Optional[datetime] = None

class PublicUserProfile(BaseModel):
    """Detailed model for Public Profile View"""
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
    # We use List[dict] or ForwardRef to avoid circular import with TripResponse
    pinned_trips: List[dict] = []

class UserInDB(User):
    hashed_password: str

class UserCreate(User):
    password: str
    registration_key: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
