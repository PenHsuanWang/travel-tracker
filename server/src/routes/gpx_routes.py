"""
API routes for GPX file specific operations.
"""

from fastapi import APIRouter, Depends, HTTPException

from src.models.user import User
from src.auth import get_current_user
from src.services.gpx_note_service import gpx_note_service
from pydantic import BaseModel
from typing import Optional


router = APIRouter()


class WaypointNotePayload(BaseModel):
    note: Optional[str] = None
    note_title: Optional[str] = None


@router.patch("/gpx/{gpx_object_key:path}/waypoints/{waypoint_index}/note", tags=["GPX"])
async def update_gpx_waypoint_note(
    gpx_object_key: str,
    waypoint_index: int,
    payload: WaypointNotePayload,
    current_user: User = Depends(get_current_user)
):
    """
    Update the note for a specific waypoint in a GPX file.
    """
    try:
        updated = gpx_note_service.update_waypoint_note(
            gpx_object_key=gpx_object_key,
            waypoint_index=waypoint_index,
            note=payload.note,
            note_title=payload.note_title,
        )
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
