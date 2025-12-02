from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(alias="_id", default=None)
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
    id: str
    username: str
    avatar_url: Optional[str] = None

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
