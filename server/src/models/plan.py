"""Pydantic models for the Plan entity and related DTOs.

Plans are mutable containers for GeoJSON features, used for pre-trip
route design and waypoint planning. Unlike Trips (which represent
completed activities with immutable GPX data), Plans are editable
design-time entities that can be promoted to Trips.

This module follows the same patterns as trip.py for consistency.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
import uuid


class MarkerIconType(str, Enum):
    """Semantic icon types for plan markers.
    
    These icons help users visually categorize waypoints during
    trip planning (e.g., campsites, water sources, hazards).
    """
    CAMP = "camp"           # ⛺ Campsite
    WATER = "water"         # 💧 Water source
    DANGER = "danger"       # ⚠️ Hazard/Warning
    VIEWPOINT = "viewpoint" # 👁️ Scenic viewpoint
    TRAILHEAD = "trailhead" # 🚶 Trail start/end
    PARKING = "parking"     # 🅿️ Parking area
    HUT = "hut"             # 🏠 Shelter/Hut
    SUMMIT = "summit"       # ⛰️ Peak/Summit
    FOOD = "food"           # 🍴 Food/Restaurant
    LODGING = "lodging"     # 🏨 Lodging
    INFO = "info"           # ℹ️ Information point
    CUSTOM = "custom"       # User-defined


class PlanStatus(str, Enum):
    """Lifecycle status of a Plan."""
    DRAFT = "draft"         # Being edited
    ACTIVE = "active"       # Ready for use
    PROMOTED = "promoted"   # Converted to Trip
    ARCHIVED = "archived"   # No longer active


class GeoJSONGeometry(BaseModel):
    """GeoJSON geometry object.
    
    Supports Point, LineString, and Polygon geometry types
    following the GeoJSON specification (RFC 7946).
    
    Note: Coordinates use [longitude, latitude] order per GeoJSON spec.
    """
    type: str  # "Point", "LineString", "Polygon"
    coordinates: Any  # [lon, lat] for Point, [[lon, lat], ...] for LineString/Polygon

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"type": "Point", "coordinates": [121.2906, 24.7553]},
                {"type": "LineString", "coordinates": [[121.29, 24.75], [121.30, 24.76]]}
            ]
        }
    )


class PlanFeatureProperties(BaseModel):
    """Properties for a Plan feature (marker, polyline, or polygon).
    
    Contains metadata and styling information for each GeoJSON feature
    in a Plan's feature collection.
    """
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    icon_type: Optional[MarkerIconType] = None
    color: str = Field(default="#3388ff", pattern=r"^#[0-9A-Fa-f]{6}$")
    stroke_width: int = Field(default=3, ge=1, le=10)
    stroke_opacity: float = Field(default=0.8, ge=0, le=1)
    fill_opacity: float = Field(default=0.3, ge=0, le=1)
    order_index: Optional[int] = None  # For itinerary sequencing
    estimated_arrival: Optional[datetime] = None
    estimated_duration_minutes: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class PlanFeature(BaseModel):
    """A single GeoJSON feature within a Plan's feature collection.
    
    Each feature represents a marker (Point), route segment (LineString),
    or area (Polygon) on the planning canvas.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: PlanFeatureProperties = Field(default_factory=PlanFeatureProperties)

    model_config = ConfigDict(populate_by_name=True)


class PlanFeatureCollection(BaseModel):
    """GeoJSON FeatureCollection wrapper for Plan features.
    
    Contains all markers, routes, and areas defined in a Plan.
    """
    type: str = "FeatureCollection"
    features: List[PlanFeature] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class ReferenceTrack(BaseModel):
    """Reference GPX track attached to a Plan (read-only baseline).
    
    Users can import existing GPX files as reference layers to help
    plan new routes. These tracks are displayed with reduced opacity
    and cannot be edited within the Plan.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    object_key: str  # Key in gps-data bucket
    filename: str
    display_name: Optional[str] = None
    color: str = Field(default="#888888", pattern=r"^#[0-9A-Fa-f]{6}$")
    opacity: float = Field(default=0.5, ge=0, le=1)
    added_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)


class Plan(BaseModel):
    """Primary Plan model stored in the `plans` collection.

    A Plan is a mutable container for designing outdoor activities
    before they occur. It contains GeoJSON features (markers, routes,
    areas) and optional reference GPX tracks.
    
    Fields:
        id: UUID-like string identifier.
        name: Human-friendly plan title.
        description: Optional detailed description.
        region: Geographic region for the plan.
        planned_start_date/planned_end_date: Target dates for the activity.
        owner_id: User who created the plan.
        member_ids: Users who can collaborate on the plan.
        features: GeoJSON FeatureCollection with all plan objects.
        reference_tracks: Read-only GPX files for reference.
        status: Lifecycle status (draft, active, promoted, archived).
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias='_id')
    name: str
    description: Optional[str] = None
    region: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    
    # Ownership & Sharing (mirrors Trip model)
    owner_id: Optional[str] = Field(default=None)
    member_ids: List[str] = Field(default_factory=list)
    is_public: bool = Field(default=False)
    
    # GeoJSON Feature Collection (the canvas)
    features: PlanFeatureCollection = Field(default_factory=PlanFeatureCollection)
    
    # Reference tracks (read-only GPX baselines)
    reference_tracks: List[ReferenceTrack] = Field(default_factory=list)
    
    # Cover image for dashboard
    cover_image_url: Optional[str] = None
    
    # Lifecycle
    status: PlanStatus = Field(default=PlanStatus.DRAFT)
    promoted_trip_id: Optional[str] = None  # Link to Trip after promotion
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "id": "plan-123",
                "name": "Yushan 3-day Route Planning",
                "region": "Taiwan",
                "planned_start_date": "2025-01-15T06:00:00",
                "planned_end_date": "2025-01-17T18:00:00",
                "status": "draft"
            }
        }
    )


# Forward reference handling for UserSummary
try:
    from src.models.user import UserSummary
except ImportError:
    class UserSummary(BaseModel):
        id: str
        username: str
        avatar_url: Optional[str] = None


class PlanResponse(Plan):
    """Plan representation returned by API with expanded user info.
    
    Includes denormalized owner and member details for display.
    """
    owner: Optional[Dict[str, Any]] = None
    members: List[Dict[str, Any]] = Field(default_factory=list)


class PlanCreate(BaseModel):
    """Payload for creating a new Plan."""
    name: str
    description: Optional[str] = None
    region: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    is_public: bool = False


class PlanUpdate(BaseModel):
    """Payload for updating Plan metadata."""
    name: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    is_public: Optional[bool] = None
    status: Optional[PlanStatus] = None
    cover_image_url: Optional[str] = None


class PlanMembersUpdate(BaseModel):
    """Payload to update plan member list."""
    member_ids: List[str]


class PlanFeatureCreate(BaseModel):
    """Payload for adding a new feature to a Plan."""
    geometry: GeoJSONGeometry
    properties: Optional[Dict[str, Any]] = None


class PlanFeatureUpdate(BaseModel):
    """Payload for updating a feature within a Plan."""
    geometry: Optional[GeoJSONGeometry] = None
    properties: Optional[Dict[str, Any]] = None


class ReferenceTrackAdd(BaseModel):
    """Payload for adding a reference track to a Plan."""
    object_key: str
    filename: str
    display_name: Optional[str] = None
    color: Optional[str] = "#888888"
    opacity: Optional[float] = 0.5


class PlanPromotionRequest(BaseModel):
    """Payload for promoting a Plan to a Trip."""
    copy_reference_tracks: bool = True
    include_planned_route_as_ghost: bool = True


class PlanPromotionResponse(BaseModel):
    """Response from Plan promotion operation."""
    plan_id: str
    trip_id: str
    reference_tracks_copied: int = 0
    ghost_layer_created: bool = False
