from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from typing import List, Optional
from src.auth import get_current_user
from src.models.user import User, UserInDB
from src.models.trip import TripResponse
from src.utils.adapter_factory import AdapterFactory
from src.services.file_upload_service import FileUploadService
from src.services.user_stats_service import user_stats_service
from pydantic import BaseModel

router = APIRouter()

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    pinned_trip_ids: Optional[List[str]] = None

class UserProfile(User):
    pinned_trips: List[TripResponse] = []

class UserStats(BaseModel):
    total_distance_km: float = 0.0
    total_elevation_gain_m: float = 0.0
    total_trips: int = 0
    earned_badges: List[str] = []


def _load_user_by_username(username: str) -> UserInDB:
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
    users_collection = mongo_adapter.get_collection("users")
    user_data = users_collection.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    if "_id" in user_data:
        user_data["_id"] = str(user_data["_id"])
    return UserInDB(**user_data)


def _build_profile_response(user_obj: UserInDB) -> dict:
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
    user_response = user_obj.model_dump()
    user_response["pinned_trips"] = []

    if user_obj.pinned_trip_ids:
        trips_collection = mongo_adapter.get_collection("trips")
        cursor = trips_collection.find({"id": {"$in": user_obj.pinned_trip_ids}})
        for trip_doc in cursor:
            trip_doc.pop("_id", None)
            user_response["pinned_trips"].append(trip_doc)

    return user_response


@router.get("/me/stats", response_model=UserStats)
async def read_user_stats(current_user: User = Depends(get_current_user)):
    """Return aggregated statistics for the authenticated user."""
    stats = user_stats_service.sync_user_stats(current_user.id)
    refreshed_user = _load_user_by_username(current_user.username)
    return UserStats(
        total_distance_km=stats["total_distance_km"],
        total_elevation_gain_m=stats["total_elevation_gain_m"],
        total_trips=stats["total_trips"],
        earned_badges=refreshed_user.earned_badges or [],
    )

@router.get("/me", response_model=UserProfile)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user's profile with pinned trips.
    """
    user_stats_service.sync_user_stats(current_user.id)
    refreshed_user = _load_user_by_username(current_user.username)
    return _build_profile_response(refreshed_user)

@router.put("/me", response_model=UserProfile)
async def update_user_me(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    """
    Update current user's profile (bio, location, pinned trips).
    """
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
    users_collection = mongo_adapter.get_collection("users")
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if not update_data:
        # Return current user with pinned trips populated
        return await read_users_me(current_user)
        
    # Validate pinned trips if provided
    if "pinned_trip_ids" in update_data:
        pinned_ids = update_data.get("pinned_trip_ids") or []
        # Remove duplicates while preserving order
        seen = set()
        deduped = []
        for trip_id in pinned_ids:
            if trip_id not in seen:
                seen.add(trip_id)
                deduped.append(trip_id)

        if len(deduped) > 3:
            raise HTTPException(status_code=400, detail="You can only pin up to 3 trips.")

        if deduped and not current_user.id:
            raise HTTPException(status_code=400, detail="User ID missing; cannot validate pinned trips.")

        if deduped:
            trips_collection = mongo_adapter.get_collection("trips")
            from bson import ObjectId
            for trip_id in deduped:
                membership_match = [{"member_ids": current_user.id}]
                try:
                    membership_match.append({"member_ids": ObjectId(current_user.id)})
                except Exception:
                    pass
                trip_doc = trips_collection.find_one({
                    "id": trip_id,
                    "$or": membership_match
                })
                if not trip_doc:
                    raise HTTPException(status_code=400, detail="Pinned trips must belong to you.")

        update_data["pinned_trip_ids"] = deduped
        
    users_collection.update_one(
        {"username": current_user.username},
        {"$set": update_data}
    )
    
    # Fetch updated user
    updated_user_data = users_collection.find_one({"username": current_user.username})
    if "_id" in updated_user_data:
        updated_user_data["_id"] = str(updated_user_data["_id"])
    
    updated_user = UserInDB(**updated_user_data)
    stats = user_stats_service.sync_user_stats(updated_user.id)
    updated_user.total_distance_km = stats["total_distance_km"]
    updated_user.total_elevation_gain_m = stats["total_elevation_gain_m"]
    updated_user.total_trips = stats["total_trips"]
    
    return _build_profile_response(updated_user)

@router.post("/me/avatar", response_model=UserProfile)
async def upload_avatar(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """
    Upload a profile picture.
    """
    try:
        # Upload file using FileUploadService (trip_id=None for avatars)
        result = FileUploadService.save_file(file, uploader_id=current_user.id, trip_id=None)
        
        # Construct avatar URL (assuming public access or signed URL logic elsewhere)
        # For now, we store the object key or a relative path
        # The frontend will need to know how to resolve this (e.g. /api/files/...)
        # Let's store the object key.
        avatar_url = result.get("object_key")
        
        if not avatar_url:
             raise HTTPException(status_code=500, detail="Failed to get avatar object key")

        # Update user profile
        mongo_adapter = AdapterFactory.create_mongodb_adapter()
        users_collection = mongo_adapter.get_collection("users")
        
        users_collection.update_one(
            {"username": current_user.username},
            {"$set": {"avatar_url": avatar_url}}
        )
        
        # Return updated user
        updated_user_data = users_collection.find_one({"username": current_user.username})
        if "_id" in updated_user_data:
            updated_user_data["_id"] = str(updated_user_data["_id"])
            
        updated_user = UserInDB(**updated_user_data)
        stats = user_stats_service.sync_user_stats(updated_user.id)
        updated_user.total_distance_km = stats["total_distance_km"]
        updated_user.total_elevation_gain_m = stats["total_elevation_gain_m"]
        updated_user.total_trips = stats["total_trips"]
        
        return _build_profile_response(updated_user)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", response_model=List[User])
async def search_users(q: str = Query(..., min_length=2), current_user: User = Depends(get_current_user)):
    """
    Search users by username or full name.
    """
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
    users_collection = mongo_adapter.get_collection("users")
    
    # Case-insensitive search
    regex_query = {"$regex": q, "$options": "i"}
    
    cursor = users_collection.find({
        "$or": [
            {"username": regex_query},
            {"full_name": regex_query}
        ]
    }).limit(10)
    
    users = []
    for user_data in cursor:
        if "_id" in user_data:
            user_data["_id"] = str(user_data["_id"])
        # Don't return sensitive info like hashed_password (User model excludes it by default)
        users.append(User(**user_data))
        
    return users

@router.get("/{username}", response_model=UserProfile)
async def get_user_profile(username: str):
    """
    Get public profile of another user with pinned trips.
    """
    user_obj = _load_user_by_username(username)
    stats = user_stats_service.sync_user_stats(user_obj.id)
    user_obj.total_distance_km = stats["total_distance_km"]
    user_obj.total_elevation_gain_m = stats["total_elevation_gain_m"]
    user_obj.total_trips = stats["total_trips"]
    return _build_profile_response(user_obj)
