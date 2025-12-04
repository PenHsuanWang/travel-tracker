from src.auth import get_current_user
from src.dependencies import (
    get_file_upload_service,
    get_mongo_adapter,
    get_user_stats_service,
)
from src.models.trip import TripResponse
from src.models.user import PublicUserProfile, User, UserInDB, UserSummary
from src.services.file_upload_service import FileUploadService
from src.services.user_stats_service import UserStatsService
from src.utils.dbbutler.mongodb_adapter import MongoDBAdapter

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


def _load_user_by_username(
    username: str,
    mongo_adapter: MongoDBAdapter,
) -> UserInDB:
    users_collection = mongo_adapter.get_collection("users")
    user_data = users_collection.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    if "_id" in user_data:
        user_data["id"] = str(user_data.pop("_id"))
    return UserInDB(**user_data)


def _build_profile_response(
    user_obj: UserInDB,
    mongo_adapter: MongoDBAdapter,
) -> dict:
    """Build a profile dict ensuring compatibility with frontend expectations.
    Construct the response from model attributes to guarantee `id` is present.
    """
    user_response = {
        "id": str(user_obj.id) if getattr(user_obj, "id", None) else None,
        "username": getattr(user_obj, "username", None),
        "email": getattr(user_obj, "email", None),
        "full_name": getattr(user_obj, "full_name", None),
        "bio": getattr(user_obj, "bio", None),
        "location": getattr(user_obj, "location", None),
        "avatar_url": getattr(user_obj, "avatar_url", None),
        "pinned_trip_ids": list(getattr(user_obj, "pinned_trip_ids", []) or []),
        "total_distance_km": getattr(user_obj, "total_distance_km", 0.0),
        "total_elevation_gain_m": getattr(user_obj, "total_elevation_gain_m", 0.0),
        "total_trips": getattr(user_obj, "total_trips", 0),
        "earned_badges": list(getattr(user_obj, "earned_badges", []) or []),
        "created_at": getattr(user_obj, "created_at", None),
        "pinned_trips": [],
    }

    if user_response["pinned_trip_ids"]:
        trips_collection = mongo_adapter.get_collection("trips")
        cursor = trips_collection.find({"id": {"$in": user_response["pinned_trip_ids"]}})
        for trip_doc in cursor:
            trip_doc.pop("_id", None)
            user_response["pinned_trips"].append(trip_doc)

    return user_response

def _build_public_profile_response(
    user_obj: UserInDB,
    mongo_adapter: MongoDBAdapter,
) -> PublicUserProfile:
    """Build a strict public profile response."""
    pinned_trips = []
    pinned_ids = list(getattr(user_obj, "pinned_trip_ids", []) or [])
    
    if pinned_ids:
        trips_collection = mongo_adapter.get_collection("trips")
        cursor = trips_collection.find({"id": {"$in": pinned_ids}})
        for trip_doc in cursor:
            trip_doc.pop("_id", None)
            pinned_trips.append(trip_doc)

    return PublicUserProfile(
        id=str(user_obj.id) if getattr(user_obj, "id", None) else None,
        username=user_obj.username,
        full_name=getattr(user_obj, "full_name", None),
        bio=getattr(user_obj, "bio", None),
        location=getattr(user_obj, "location", None),
        avatar_url=getattr(user_obj, "avatar_url", None),
        created_at=user_obj.created_at,
        total_distance_km=getattr(user_obj, "total_distance_km", 0.0),
        total_elevation_gain_m=getattr(user_obj, "total_elevation_gain_m", 0.0),
        total_trips=getattr(user_obj, "total_trips", 0),
        earned_badges=list(getattr(user_obj, "earned_badges", []) or []),
        pinned_trips=pinned_trips
    )

@router.get("/public", response_model=List[UserSummary])
async def list_public_users(
    skip: int = 0, 
    limit: int = 20, 
    q: Optional[str] = None,
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
):
    """
    List public users for the community gallery.
    """
    users_collection = mongo_adapter.get_collection("users")
    
    query = {}
    if q:
        regex_query = {"$regex": q, "$options": "i"}
        query = {
            "$or": [
                {"username": regex_query},
                {"full_name": regex_query}
            ]
        }
        
    cursor = users_collection.find(query).skip(skip).limit(limit)
    
    users = []
    for user_data in cursor:
        if "_id" in user_data:
            user_data["id"] = str(user_data.pop("_id"))
        users.append(UserSummary(**user_data))
        
    return users



@router.get("/me/stats", response_model=UserStats)
async def read_user_stats(
    current_user: User = Depends(get_current_user),
    stats_service: UserStatsService = Depends(get_user_stats_service),
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
):
    """Return aggregated statistics for the authenticated user."""
    stats = stats_service.sync_user_stats(current_user.id)
    refreshed_user = _load_user_by_username(current_user.username, mongo_adapter)
    return UserStats(
        total_distance_km=stats["total_distance_km"],
        total_elevation_gain_m=stats["total_elevation_gain_m"],
        total_trips=stats["total_trips"],
        earned_badges=refreshed_user.earned_badges or [],
    )

@router.get("/me", response_model=UserProfile)
async def read_users_me(
    current_user: User = Depends(get_current_user),
    stats_service: UserStatsService = Depends(get_user_stats_service),
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
):
    """
    Get current user's profile with pinned trips.
    """
    stats_service.sync_user_stats(current_user.id)
    refreshed_user = _load_user_by_username(current_user.username, mongo_adapter)
    return _build_profile_response(refreshed_user, mongo_adapter)

@router.put("/me", response_model=UserProfile)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
    stats_service: UserStatsService = Depends(get_user_stats_service),
):
    """
    Update current user's profile (bio, location, pinned trips).
    """
    users_collection = mongo_adapter.get_collection("users")
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if not update_data:
        # Return current user with pinned trips populated
        stats_service.sync_user_stats(current_user.id)
        refreshed_user = _load_user_by_username(current_user.username, mongo_adapter)
        return _build_profile_response(refreshed_user, mongo_adapter)
        
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
    
    # Fetch updated user and normalize _id -> id
    updated_user_data = users_collection.find_one({"username": current_user.username})
    if updated_user_data and "_id" in updated_user_data:
        updated_user_data["id"] = str(updated_user_data.pop("_id"))
    updated_user = UserInDB(**updated_user_data)
    stats = stats_service.sync_user_stats(updated_user.id)
    updated_user.total_distance_km = stats["total_distance_km"]
    updated_user.total_elevation_gain_m = stats["total_elevation_gain_m"]
    updated_user.total_trips = stats["total_trips"]
    
    return _build_profile_response(updated_user, mongo_adapter)

@router.post("/me/avatar", response_model=UserProfile)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    upload_service: FileUploadService = Depends(get_file_upload_service),
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
    stats_service: UserStatsService = Depends(get_user_stats_service),
):
    """
    Upload a profile picture.
    """
    try:
        # Upload file using FileUploadService (trip_id=None for avatars)
        result = upload_service.upload_file(file, uploader_id=current_user.id, trip_id=None)
        
        # Construct avatar URL (assuming public access or signed URL logic elsewhere)
        # For now, we store the object key or a relative path
        # The frontend will need to know how to resolve this (e.g. /api/files/...)
        # Let's store the object key.
        avatar_url = result.get("object_key")
        
        if not avatar_url:
             raise HTTPException(status_code=500, detail="Failed to get avatar object key")

        # Update user profile
        users_collection = mongo_adapter.get_collection("users")
        
        users_collection.update_one(
            {"username": current_user.username},
            {"$set": {"avatar_url": avatar_url}}
        )
        
        # Return updated user
        updated_user_data = users_collection.find_one({"username": current_user.username})
        if updated_user_data and "_id" in updated_user_data:
            updated_user_data["id"] = str(updated_user_data.pop("_id"))
            
        updated_user = UserInDB(**updated_user_data)
        stats = stats_service.sync_user_stats(updated_user.id)
        updated_user.total_distance_km = stats["total_distance_km"]
        updated_user.total_elevation_gain_m = stats["total_elevation_gain_m"]
        updated_user.total_trips = stats["total_trips"]
        
        return _build_profile_response(updated_user, mongo_adapter)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", response_model=List[User])
async def search_users(
    q: str = Query(..., min_length=2),
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
):
    """
    Search users by username or full name.
    """
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
            user_data["id"] = str(user_data["_id"])
        # Don't return sensitive info like hashed_password (User model excludes it by default)
        users.append(User(**user_data))
        
    return users

@router.get("/{username}", response_model=PublicUserProfile)
async def get_user_profile(
    username: str,
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
    stats_service: UserStatsService = Depends(get_user_stats_service),
):
    """
    Get public profile of another user with pinned trips.
    """
    user_obj = _load_user_by_username(username, mongo_adapter)
    stats = stats_service.sync_user_stats(user_obj.id)
    user_obj.total_distance_km = stats["total_distance_km"]
    user_obj.total_elevation_gain_m = stats["total_elevation_gain_m"]
    user_obj.total_trips = stats["total_trips"]
    return _build_public_profile_response(user_obj, mongo_adapter)
