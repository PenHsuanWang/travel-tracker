from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from src.models.trip import Trip
from src.services.trip_service import TripService

router = APIRouter()
trip_service = TripService()

@router.post("/", response_model=Trip, status_code=status.HTTP_201_CREATED)
async def create_trip(trip: Trip):
    """
    Create a new trip.
    """
    try:
        return trip_service.create_trip(trip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Trip])
async def list_trips():
    """
    List all trips.
    """
    try:
        return trip_service.get_trips()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str):
    """
    Get a specific trip by ID.
    """
    trip = trip_service.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@router.put("/{trip_id}", response_model=Trip)
async def update_trip(trip_id: str, update_data: Dict[str, Any]):
    """
    Update a trip.
    """
    trip = trip_service.update_trip(trip_id, update_data)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(trip_id: str):
    """
    Delete a trip.
    """
    success = trip_service.delete_trip(trip_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trip not found or could not be deleted")
    return None
