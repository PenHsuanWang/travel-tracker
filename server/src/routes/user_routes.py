from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from typing import List, Optional
from src.auth import get_current_user
from src.models.user import User, UserInDB
from src.models.trip import TripResponse
from src.utils.adapter_factory import AdapterFactory
from src.services.file_upload_service import FileUploadService
from pydantic import BaseModel

router = APIRouter()

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    pinned_trip_ids: Optional[List[str]] = None

class UserProfile(User):
    pinned_trips: List[TripResponse] = []

@router.get("/me", response_model=UserProfile)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user's profile with pinned trips.
    """
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
    
    # Convert current_user to dict to append pinned_trips
    user_response = current_user.model_dump()
    user_response["pinned_trips"] = []
    
    if current_user.pinned_trip_ids:
        trips_collection = mongo_adapter.get_collection("trips")
        # Find trips where id is in pinned_trip_ids
        cursor = trips_collection.find({"id": {"$in": current_user.pinned_trip_ids}})
        
        for trip_doc in cursor:
            if "_id" in trip_doc:
                del trip_doc["_id"] # Remove Mongo ID, use 'id' field
            user_response["pinned_trips"].append(trip_doc)
            
    return user_response

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
        # TODO: Verify user is a member of these trips
        pass
        
    users_collection.update_one(
        {"username": current_user.username},
        {"$set": update_data}
    )
    
    # Fetch updated user
    updated_user_data = users_collection.find_one({"username": current_user.username})
    if "_id" in updated_user_data:
        updated_user_data["_id"] = str(updated_user_data["_id"])
    
    updated_user = UserInDB(**updated_user_data)
    
    # Populate pinned trips for response
    user_response = updated_user.model_dump()
    user_response["pinned_trips"] = []
    
    if updated_user.pinned_trip_ids:
        trips_collection = mongo_adapter.get_collection("trips")
        cursor = trips_collection.find({"id": {"$in": updated_user.pinned_trip_ids}})
        for trip_doc in cursor:
            if "_id" in trip_doc:
                del trip_doc["_id"]
            user_response["pinned_trips"].append(trip_doc)
            
    return user_response

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
        
        # Populate pinned trips (empty or existing)
        # For simplicity, we can just call read_users_me logic or duplicate it
        # Let's duplicate the minimal logic
        user_response = updated_user.model_dump()
        user_response["pinned_trips"] = []
        if updated_user.pinned_trip_ids:
            trips_collection = mongo_adapter.get_collection("trips")
            cursor = trips_collection.find({"id": {"$in": updated_user.pinned_trip_ids}})
            for trip_doc in cursor:
                if "_id" in trip_doc:
                    del trip_doc["_id"]
                user_response["pinned_trips"].append(trip_doc)
                
        return user_response
        
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
async def get_user_profile(username: str, current_user: User = Depends(get_current_user)):
    """
    Get public profile of another user with pinned trips.
    """
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
    users_collection = mongo_adapter.get_collection("users")
    
    user_data = users_collection.find_one({"username": username})
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
        
    if "_id" in user_data:
        user_data["_id"] = str(user_data["_id"])
        
    user_obj = UserInDB(**user_data)
    
    # Populate pinned trips
    user_response = user_obj.model_dump()
    user_response["pinned_trips"] = []
    
    if user_obj.pinned_trip_ids:
        trips_collection = mongo_adapter.get_collection("trips")
        cursor = trips_collection.find({"id": {"$in": user_obj.pinned_trip_ids}})
        for trip_doc in cursor:
            if "_id" in trip_doc:
                del trip_doc["_id"]
            user_response["pinned_trips"].append(trip_doc)
            
    return user_response
