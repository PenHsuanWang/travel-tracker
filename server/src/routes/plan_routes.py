"""Plan management routes.

Expose CRUD endpoints for Plan resources, feature management, reference
track operations, GPX ingestion, and trip-to-plan cloning. Endpoints 
generally return Pydantic models from :mod:`src.models.plan` and require 
authentication for modifying operations.

This module follows the same patterns as trip_routes.py.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from src.models.plan import (
    Plan, PlanResponse, PlanCreate, PlanUpdate, PlanMembersUpdate,
    PlanFeature, PlanFeatureCreate, PlanFeatureUpdate,
    ReferenceTrack, ReferenceTrackAdd,
    GeoJSONGeometry,
    GpxIngestionPreview, GpxIngestionStrategy, GpxStrategyPayload,
    PlanCreateWithGpx, ImportTripRequest
)
from src.services.plan_service import PlanService
from src.auth import get_current_user, get_current_user_optional
from src.models.user import User

router = APIRouter()
plan_service = PlanService()

# Maximum GPX file size (10 MB)
MAX_GPX_FILE_SIZE = 10 * 1024 * 1024


# =============================================================================
# GPX Ingestion Endpoints
# =============================================================================

@router.post("/ingest-gpx", response_model=GpxIngestionPreview, response_model_by_alias=False)
async def ingest_gpx(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a GPX file for parsing and preview.
    
    Returns a preview of the track and detected waypoints without
    creating a plan. The file is stored temporarily for subsequent
    plan creation.
    
    - **file**: GPX file (max 10MB)
    
    Returns GpxIngestionPreview with:
    - temp_file_key: Temporary storage key
    - track_geometry: Polyline coordinates for map preview
    - track_summary: Distance, elevation gain, etc.
    - detected_waypoints: Parsed waypoints with coordinates and times
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.gpx'):
        raise HTTPException(
            status_code=400,
            detail="File must be a GPX file (.gpx extension)"
        )
    
    # Validate file size BEFORE reading into memory (security: prevent DOS attacks)
    # file.size may be None for chunked uploads, but we check it when available
    if file.size is not None and file.size > MAX_GPX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_GPX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Read file content
    content = await file.read()
    
    # Double-check file size after reading (for cases where size wasn't known beforehand)
    if len(content) > MAX_GPX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_GPX_FILE_SIZE // (1024*1024)}MB"
        )
    
    try:
        preview = plan_service.ingest_gpx(content, file.filename, current_user.id)
        return preview
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse GPX file: {str(e)}")


@router.post("/import-trip/{trip_id}", response_model=Plan, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def import_trip_to_plan(
    trip_id: str,
    request: ImportTripRequest,
    current_user: User = Depends(get_current_user)
):
    """Clone a Trip into a new Plan (FR-012).
    
    Copies the Trip's GPX file as a reference track and converts
    its waypoints to Plan features using the specified time strategy.
    
    The resulting Plan has NO link to the original Trip (fully decoupled).
    
    - **trip_id**: Source Trip ID
    - **name**: Name for the new plan
    - **planned_start_date**: Optional start date for time shifting
    - **gpx_strategy**: Optional time shift strategy
    """
    try:
        # Determine strategy
        strategy = GpxIngestionStrategy.RELATIVE_TIME_SHIFT
        if request.gpx_strategy and request.gpx_strategy.mode:
            strategy = request.gpx_strategy.mode
        
        plan = plan_service.create_plan_from_trip(
            trip_id=trip_id,
            user_id=current_user.id,
            name=request.name,
            planned_start_date=request.planned_start_date,
            strategy=strategy
        )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Plan CRUD Endpoints
# =============================================================================

@router.post("/", response_model=Plan, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_plan(plan_data: PlanCreateWithGpx, current_user: User = Depends(get_current_user)):
    """Create a new plan.
    
    The authenticated user becomes the owner and is automatically added
    as a member of the plan.
    
    If gpx_strategy is provided, the plan will be created with features
    imported from the referenced GPX file.
    """
    try:
        plan = Plan(
            name=plan_data.name,
            description=plan_data.description,
            region=plan_data.region,
            planned_start_date=plan_data.planned_start_date,
            planned_end_date=plan_data.planned_end_date,
            is_public=plan_data.is_public,
            owner_id=current_user.id,
            member_ids=[current_user.id] if current_user.id else []
        )
        
        # Check if GPX strategy is provided
        if plan_data.gpx_strategy:
            return plan_service.create_plan_with_gpx(plan, plan_data.gpx_strategy)
        else:
            return plan_service.create_plan(plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[PlanResponse], response_model_by_alias=False)
async def list_plans(
    user_id: Optional[str] = Query(None, description="Filter by user membership"),
    status: Optional[str] = Query(None, description="Filter by plan status")
):
    """List all plans. Optionally filter by user_id (membership) or status."""
    try:
        return plan_service.get_plans(user_id=user_id, status=status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{plan_id}", response_model=PlanResponse, response_model_by_alias=False)
async def get_plan(
    plan_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a specific plan by ID.
    
    Public plans are accessible to everyone (including unauthenticated users).
    Private plans require authentication and membership.
    """
    plan = plan_service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check access permissions for private plans
    if not plan.is_public:
        if not current_user:
            raise HTTPException(
                status_code=403, 
                detail="This plan is private. Please login to view."
            )
        
        is_owner = str(plan.owner_id) == str(current_user.id)
        member_ids = [str(m) for m in plan.member_ids] if plan.member_ids else []
        is_member = str(current_user.id) in member_ids
        
        if not (is_owner or is_member):
            raise HTTPException(
                status_code=403, 
                detail="You don't have permission to view this private plan"
            )
    
    return plan


@router.put("/{plan_id}", response_model=Plan, response_model_by_alias=False)
async def update_plan(
    plan_id: str,
    update_data: PlanUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a plan's metadata.
    
    Only the owner or members can update a plan.
    """
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check permission (owner or member)
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to edit this plan")
    
    # Convert Pydantic model to dict, excluding None values
    update_dict = update_data.model_dump(exclude_none=True)
    
    plan = plan_service.update_plan(plan_id, update_dict)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(plan_id: str, current_user: User = Depends(get_current_user)):
    """Delete a plan.
    
    Only the owner can delete a plan.
    """
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if str(existing_plan.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the owner can delete this plan")
    
    success = plan_service.delete_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found or could not be deleted")
    return None


@router.put("/{plan_id}/members", response_model=Plan, response_model_by_alias=False)
async def update_plan_members(
    plan_id: str,
    members_update: PlanMembersUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update plan members.
    
    Only the owner can manage members.
    """
    try:
        plan = plan_service.update_members(plan_id, members_update.member_ids, current_user.id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan
    except PermissionError:
        raise HTTPException(status_code=403, detail="Only the owner can manage members")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Phase 2 - Logistics & Itinerary Endpoints (Module D & B)
# =============================================================================

class LogisticsUpdatePayload(BaseModel):
    """Request payload for updating logistics data."""
    roster: Optional[List[Dict[str, Any]]] = None
    logistics: Optional[Dict[str, Any]] = None
    checklist: Optional[List[Dict[str, Any]]] = None


class DaySummariesPayload(BaseModel):
    """Request payload for updating day summaries."""
    day_summaries: List[Dict[str, Any]]


@router.put("/{plan_id}/logistics", response_model=Plan, response_model_by_alias=False)
async def update_logistics(
    plan_id: str,
    payload: LogisticsUpdatePayload,
    current_user: User = Depends(get_current_user)
):
    """Update logistics-related data (roster, logistics info, gear checklist).
    
    Located in Left Sidebar > Team/Gear Tabs (Zone A).
    This endpoint provides atomic updates without requiring the full plan payload.
    
    - **roster**: Team member list (FR-D01)
    - **logistics**: Transport and insurance info (FR-D02)
    - **checklist**: Gear packing list (FR-D03)
    """
    try:
        plan = plan_service.update_logistics(
            plan_id=plan_id,
            roster=payload.roster,
            logistics=payload.logistics,
            checklist=payload.checklist,
            current_user_id=current_user.id
        )
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{plan_id}/days", response_model=Plan, response_model_by_alias=False)
async def update_day_summaries(
    plan_id: str,
    payload: DaySummariesPayload,
    current_user: User = Depends(get_current_user)
):
    """Update day summaries for the structured itinerary.
    
    Located in Right Sidebar (Zone C) Day Headers.
    This endpoint provides atomic updates to the itinerary structure.
    
    - **day_summaries**: List of day summary objects with route overview and conditions (FR-B02)
    """
    try:
        plan = plan_service.update_day_summaries(
            plan_id=plan_id,
            day_summaries=payload.day_summaries,
            current_user_id=current_user.id
        )
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Feature CRUD Endpoints
# =============================================================================

@router.post("/{plan_id}/features", response_model=PlanFeature, status_code=status.HTTP_201_CREATED)
async def add_feature(
    plan_id: str,
    feature_data: PlanFeatureCreate,
    current_user: User = Depends(get_current_user)
):
    """Add a feature (marker, polyline, or polygon) to a plan."""
    import logging
    logger = logging.getLogger(__name__)
    logger.debug(f"add_feature endpoint: Received geometry={feature_data.geometry}, properties={feature_data.properties}")
    
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to add features to this plan")
    
    feature = plan_service.add_feature(plan_id, feature_data.geometry, feature_data.properties)
    if not feature:
        raise HTTPException(status_code=500, detail="Failed to add feature")
    return feature


@router.put("/{plan_id}/features/{feature_id}", response_model=PlanFeature)
async def update_feature(
    plan_id: str,
    feature_id: str,
    feature_data: PlanFeatureUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a feature's geometry or properties."""
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to update features in this plan")
    
    updates = {}
    if feature_data.geometry:
        updates["geometry"] = feature_data.geometry.model_dump()
    if feature_data.properties:
        updates["properties"] = feature_data.properties
    
    feature = plan_service.update_feature(plan_id, feature_id, updates)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature


@router.delete("/{plan_id}/features/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feature(
    plan_id: str,
    feature_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a feature from a plan."""
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to delete features from this plan")
    
    success = plan_service.delete_feature(plan_id, feature_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feature not found")
    return None


class FeatureCascadeUpdateRequest(BaseModel):
    """Request model for updating a feature with optional cascade time propagation."""
    geometry: Optional[dict] = None
    properties: Optional[dict] = None
    cascade_time: bool = False  # If true, propagate time changes to subsequent features


@router.put("/{plan_id}/features/{feature_id}/cascade", response_model=Plan)
async def update_feature_with_cascade(
    plan_id: str,
    feature_id: str,
    update_data: FeatureCascadeUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update a feature with optional cascade time propagation.
    
    When cascade_time is True and arrival_time/departure_time is modified,
    the time changes will be propagated to all subsequent features in the itinerary.
    """
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to update features in this plan")
    
    updates = {}
    if update_data.geometry:
        updates["geometry"] = update_data.geometry
    if update_data.properties:
        updates["properties"] = update_data.properties
    
    try:
        updated_plan = plan_service.update_feature_with_cascade(
            plan_id, 
            feature_id, 
            updates, 
            cascade=update_data.cascade_time
        )
        if not updated_plan:
            raise HTTPException(status_code=404, detail="Feature not found")
        return updated_plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FeatureOrderItem(BaseModel):
    feature_id: str
    order_index: int


class FeatureReorderRequest(BaseModel):
    feature_orders: List[FeatureOrderItem]


@router.put("/{plan_id}/features/reorder", status_code=status.HTTP_200_OK)
async def reorder_features(
    plan_id: str,
    reorder_data: FeatureReorderRequest,
    current_user: User = Depends(get_current_user)
):
    """Batch update feature order_index values for itinerary sequencing."""
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to reorder features in this plan")
    
    orders = [item.model_dump() for item in reorder_data.feature_orders]
    success = plan_service.reorder_features(plan_id, orders)
    
    return {"success": success}


# =============================================================================
# Reference Track Endpoints
# =============================================================================

@router.post("/{plan_id}/reference-tracks", response_model=ReferenceTrack, status_code=status.HTTP_201_CREATED)
async def add_reference_track(
    plan_id: str,
    track_data: ReferenceTrackAdd,
    current_user: User = Depends(get_current_user)
):
    """Add a reference GPX track to a plan."""
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to add reference tracks to this plan")
    
    track = plan_service.add_reference_track(plan_id, track_data)
    if not track:
        raise HTTPException(status_code=500, detail="Failed to add reference track")
    return track


@router.post("/{plan_id}/reference-tracks/upload", response_model=ReferenceTrack, status_code=status.HTTP_201_CREATED)
async def upload_reference_track(
    plan_id: str,
    file: UploadFile = File(...),
    display_name: Optional[str] = None,
    color: Optional[str] = None,
    opacity: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    """Upload a GPX file and add it as a reference track.
    
    This endpoint handles the file upload, stores it in MinIO,
    and creates a reference track entry for the plan.
    """
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to add reference tracks to this plan")
    
    # Validate file
    if not file.filename or not file.filename.lower().endswith('.gpx'):
        raise HTTPException(status_code=400, detail="File must have .gpx extension")
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_GPX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="GPX file exceeds 10MB limit")
    
    try:
        track = plan_service.upload_reference_track(
            plan_id=plan_id,
            file_bytes=file_content,
            filename=file.filename,
            user_id=str(current_user.id),
            display_name=display_name,
            color=color,
            opacity=opacity
        )
        if not track:
            raise HTTPException(status_code=500, detail="Failed to upload reference track")
        return track
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{plan_id}/reference-tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reference_track(
    plan_id: str,
    track_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a reference track from a plan."""
    # Check plan exists and user has permission
    existing_plan = plan_service.get_plan(plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    is_owner = str(existing_plan.owner_id) == str(current_user.id)
    member_ids = [str(m) for m in existing_plan.member_ids] if existing_plan.member_ids else []
    is_member = str(current_user.id) in member_ids
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Not authorized to remove reference tracks from this plan")
    
    success = plan_service.remove_reference_track(plan_id, track_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reference track not found")
    return None

