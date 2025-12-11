"""Trip management routes.

Expose CRUD endpoints for Trip resources and a convenience endpoint to
create a trip while uploading a GPX file. Endpoints generally return
Pydantic models from :mod:`src.models.trip` and require authentication
for modifying operations.
"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from src.models.trip import Trip, TripResponse, TripMembersUpdate
from src.services.trip_service import TripService
from src.services.file_upload_service import FileUploadService
from datetime import datetime
from src.auth import get_current_user
from src.models.user import User

router = APIRouter()
trip_service = TripService()


class TripCreateWithGpxResponse(BaseModel):
    trip: Trip
    gpx_metadata_extracted: Optional[bool] = None
    gpx_start_datetime: Optional[str] = None
    gpx_end_datetime: Optional[str] = None
    trip_dates_auto_filled: Optional[bool] = None
    auto_fill_reason: Optional[str] = None
    gpx_error: Optional[str] = None
    upload_metadata: Optional[Dict[str, Any]] = None

@router.post("/", response_model=Trip, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_trip(trip: Trip, current_user: User = Depends(get_current_user)):
    """
    Create a new trip.
    """
    try:
        if current_user.id:
            trip.owner_id = current_user.id
            if not trip.member_ids:
                trip.member_ids = [current_user.id]
        return trip_service.create_trip(trip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_date_field(value: Optional[str]) -> Optional[datetime]:
    """Parse YYYY-MM-DD style inputs to datetime; return None for falsy/invalid."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@router.post("/with-gpx", response_model=TripCreateWithGpxResponse, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_trip_with_gpx(
    name: str = Form(...),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    gpx_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new trip, optionally ingesting a GPX file to auto-fill dates.
    Dates provided by the user are never overridden in v1.
    """
    try:
        parsed_start = _parse_date_field(start_date)
        parsed_end = _parse_date_field(end_date)
        trip = Trip(
            name=name,
            start_date=parsed_start,
            end_date=parsed_end,
            region=region,
            notes=notes,
        )
        
        if current_user.id:
            trip.owner_id = current_user.id
            trip.member_ids = [current_user.id]

        created_trip = trip_service.create_trip(trip)

        gpx_metadata_extracted = None
        gpx_start_datetime = None
        gpx_end_datetime = None
        trip_dates_auto_filled = None
        auto_fill_reason = None
        upload_metadata: Optional[Dict[str, Any]] = None
        gpx_error: Optional[str] = None

        if gpx_file:
            try:
                result = FileUploadService.save_file(gpx_file, trip_id=created_trip.id)
                upload_metadata = result
                gpx_metadata_extracted = result.get("gpx_metadata_extracted")
                gpx_start_datetime = result.get("gpx_start_datetime")
                gpx_end_datetime = result.get("gpx_end_datetime")
                trip_dates_auto_filled = result.get("trip_dates_auto_filled")
                auto_fill_reason = result.get("auto_fill_reason")

                # If auto-fill updated the trip, refresh it
                if result.get("trip"):
                    created_trip = Trip(**result["trip"])
            except Exception as exc:
                gpx_error = f"GPX upload or parse failed: {exc}"

        return TripCreateWithGpxResponse(
            trip=created_trip,
            gpx_metadata_extracted=gpx_metadata_extracted,
            gpx_start_datetime=gpx_start_datetime,
            gpx_end_datetime=gpx_end_datetime,
            trip_dates_auto_filled=trip_dates_auto_filled,
            auto_fill_reason=auto_fill_reason,
            gpx_error=gpx_error,
            upload_metadata=upload_metadata,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[TripResponse], response_model_by_alias=False)
async def list_trips(user_id: Optional[str] = None):
    """
    List all trips. Optionally filter by user_id (membership).
    """
    try:
        return trip_service.get_trips(user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{trip_id}", response_model=TripResponse, response_model_by_alias=False)
async def get_trip(trip_id: str):
    """
    Get a specific trip by ID.
    """
    trip = trip_service.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@router.put("/{trip_id}", response_model=Trip, response_model_by_alias=False)
async def update_trip(trip_id: str, update_data: Dict[str, Any], current_user: User = Depends(get_current_user)):
    """
    Update a trip.
    """
    # Check ownership
    existing_trip = trip_service.get_trip(trip_id)
    if not existing_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if existing_trip.owner_id and existing_trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this trip")

    trip = trip_service.update_trip(trip_id, update_data)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@router.put("/{trip_id}/members", response_model=Trip, response_model_by_alias=False)
async def update_trip_members(trip_id: str, members_update: TripMembersUpdate, current_user: User = Depends(get_current_user)):
    """
    Update trip members.
    """
    try:
        trip = trip_service.update_members(trip_id, members_update.member_ids, current_user.id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        return trip
    except PermissionError:
        raise HTTPException(status_code=403, detail="Only the owner can manage members")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    """
    Delete a trip.
    """
    # Check ownership
    existing_trip = trip_service.get_trip(trip_id)
    if not existing_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if existing_trip.owner_id and existing_trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this trip")

    success = trip_service.delete_trip(trip_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trip not found or could not be deleted")
    return None
