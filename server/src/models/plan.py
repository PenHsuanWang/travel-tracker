"""Pydantic models for the Plan entity and related DTOs.

Plans are mutable containers for GeoJSON features, used for pre-trip
route design and waypoint planning. Unlike Trips (which represent
completed activities with immutable GPX data), Plans remain standalone
drafts and are never converted or promoted into Trips.

This module follows the same patterns as trip.py for consistency.
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
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


class FeatureCategory(str, Enum):
    """Category classification for plan features.
    
    Categories determine:
    - Which geometry types are valid
    - Whether time information (estimated_arrival) is allowed
    - How features appear in the Itinerary panel
    - Sorting and grouping behavior
    
    UI Mapping:
    - WAYPOINT displays as "Checkpoint" in the Itinerary panel
    """
    WAYPOINT = "waypoint"       # 📍 Time-enabled point (like GPX waypoint) - displays as "Checkpoint"
    MARKER = "marker"           # 📌 Static POI marker (no time)
    ROUTE = "route"             # 〰️ LineString path (no time)
    AREA = "area"               # ⬡ Polygon/Rectangle region (no time)
    REFERENCE_TRACK = "reference_track"  # External GPX baseline


class PlanStatus(str, Enum):
    """Lifecycle status of a Plan."""
    DRAFT = "draft"         # Being edited
    ACTIVE = "active"       # Ready for use
    ARCHIVED = "archived"   # No longer active


class FillPattern(str, Enum):
    """Fill pattern options for polygon features (FE-05).
    
    Determines how polygon interiors are rendered:
    - SOLID: Standard fill with opacity
    - CROSSHATCH: Diagonal line pattern (for hazard zones)
    - NONE: Outline only, no fill
    """
    SOLID = "solid"
    CROSSHATCH = "crosshatch"
    NONE = "none"


class SemanticType(str, Enum):
    """Semantic categorization for plan features (FR-A01).
    
    Used to tag waypoints and markers with specific meanings
    for safety planning and visual distinction on the map.
    """
    WATER = "water"         # 💧 Water Source
    CAMP = "camp"           # ⛺ Campsite
    SIGNAL = "signal"       # 📶 Mobile Signal Coverage
    HAZARD = "hazard"       # ⚠️ Hazardous Area/Point
    CHECKIN = "checkin"     # 🆘 Safety Check-in Location (FR-A04)
    GENERIC = "generic"     # Default/Unspecified


class RouteType(str, Enum):
    """Route classification for LineString features (FR-A03).
    
    Determines visual styling:
    - MAIN: Primary route (default solid line)
    - ESCAPE: Emergency/alternative route (green dashed line)
    """
    MAIN = "main"
    ESCAPE = "escape"


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
    
    Validation Rules:
    - `category` determines allowed geometry types and time fields
    - `estimated_arrival` is ONLY valid when category == WAYPOINT
    - `estimated_duration_minutes` is ONLY valid when category == WAYPOINT
    - `icon_type` is ONLY valid for WAYPOINT and MARKER categories
    - `elevation` is optional metadata for waypoints (from GPS or manual)
    """
    # Category (required for proper feature classification)
    category: FeatureCategory = Field(default=FeatureCategory.MARKER)
    
    # Core metadata
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    
    # Point-specific properties (WAYPOINT/MARKER only)
    icon_type: Optional[MarkerIconType] = None
    elevation: Optional[float] = None  # meters, for waypoint altitude display
    
    # Time dimension (WAYPOINT only - enforced by validator)
    estimated_arrival: Optional[datetime] = None  # When user plans to reach this point
    estimated_duration_minutes: Optional[int] = None  # Planned stay duration at this point
    
    # Time Shift Support (WAYPOINT only - for GPX ingestion)
    original_gpx_time: Optional[datetime] = None  # Preserved from source GPX
    time_offset_seconds: Optional[float] = None   # Delta from original GPX start time
    
    # Styling
    color: str = Field(default="#3388ff", pattern=r"^#[0-9A-Fa-f]{6}$")
    stroke_width: int = Field(default=3, ge=1, le=10, alias="strokeWidth")
    stroke_opacity: float = Field(default=0.8, ge=0, le=1, alias="opacity")
    fill_opacity: float = Field(default=0.3, ge=0, le=1, alias="fillOpacity")
    # FE-05: Fill pattern for polygons (solid, crosshatch, none)
    fill_pattern: Optional[FillPattern] = Field(default=FillPattern.SOLID, alias="fillPattern")
    # Fill color (optional, defaults to stroke color)
    fill_color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$", alias="fillColor")
    
    # UI metadata
    shape_type: Optional[str] = None  # 'rectangle', 'circle', etc. for polygon variants
    
    # Ordering
    order_index: Optional[int] = None  # For itinerary sequencing (fallback when no time)
    
    # Phase 2 - Semantic Categorization (Module A)
    semantic_type: SemanticType = Field(default=SemanticType.GENERIC)  # FR-A01
    route_type: RouteType = Field(default=RouteType.MAIN)  # FR-A03: Main vs Escape route
    is_safety_checkin: bool = Field(default=False)  # FR-A04: Safety check-in location flag
    
    # Phase 2 - Hazard Grading (Module A)
    hazard_subtype: Optional[str] = None  # e.g., 'river_tracing', 'rock_climbing', 'other'
    difficulty_grade: Optional[str] = None  # e.g., 'Class C', '5.10a'
    
    # Phase 2 - Export Support (Module E)
    decision_notes: Optional[str] = None  # FR-E01: If-Else logic notes for critical decisions
    
    # Phase 2 - Itinerary Support (Module B)
    manual_day_break: bool = Field(default=False)  # FR-B03: Force new day after this feature
    
    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)
    
    @field_validator('estimated_arrival', mode='before')
    @classmethod
    def parse_estimated_arrival(cls, v):
        """Parse estimated_arrival from string if needed."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                return None
        return v
    
    @model_validator(mode='after')
    def validate_time_only_for_points(self):
        """Ensure time-related fields are only set for Point geometry features.
        
        With the Unified Marker System (PRD v1.1), any Point feature
        (WAYPOINT or MARKER) can optionally have estimated_arrival.
        The presence of the time attribute determines whether the marker
        appears in the Timeline or Reference List in the UI.
        
        Routes (LineString) and Areas (Polygon) cannot have time attributes.
        """
        # Point-based categories that can have time (Unified Marker System)
        point_categories = (FeatureCategory.WAYPOINT, FeatureCategory.MARKER)
        
        if self.estimated_arrival is not None and self.category not in point_categories:
            raise ValueError(
                f'estimated_arrival is only allowed for Point features (WAYPOINT/MARKER), '
                f'got category={self.category}'
            )
        if self.estimated_duration_minutes is not None and self.category not in point_categories:
            raise ValueError(
                f'estimated_duration_minutes is only allowed for Point features (WAYPOINT/MARKER), '
                f'got category={self.category}'
            )
        if self.original_gpx_time is not None and self.category not in point_categories:
            raise ValueError(
                f'original_gpx_time is only allowed for Point features (WAYPOINT/MARKER), '
                f'got category={self.category}'
            )
        if self.time_offset_seconds is not None and self.category not in point_categories:
            raise ValueError(
                f'time_offset_seconds is only allowed for Point features (WAYPOINT/MARKER), '
                f'got category={self.category}'
            )
        return self
    
    @model_validator(mode='after')
    def validate_icon_for_point_categories(self):
        """Ensure icon_type is only set for point-based categories."""
        if self.icon_type is not None and self.category not in (FeatureCategory.WAYPOINT, FeatureCategory.MARKER):
            raise ValueError(
                f'icon_type is only allowed for WAYPOINT/MARKER categories, '
                f'got category={self.category}'
            )
        return self


# Geometry type to category mapping for validation
GEOMETRY_CATEGORY_MAP = {
    FeatureCategory.WAYPOINT: ['Point'],
    FeatureCategory.MARKER: ['Point'],
    FeatureCategory.ROUTE: ['LineString'],
    FeatureCategory.AREA: ['Polygon'],
}


class PlanFeature(BaseModel):
    """A single GeoJSON feature within a Plan's feature collection.
    
    Each feature represents a marker (Point), route segment (LineString),
    or area (Polygon) on the planning canvas.
    
    Validation ensures geometry type matches category:
    - WAYPOINT, MARKER -> Point
    - ROUTE -> LineString
    - AREA -> Polygon
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: PlanFeatureProperties = Field(default_factory=PlanFeatureProperties)

    model_config = ConfigDict(populate_by_name=True)
    
    @model_validator(mode='after')
    def validate_geometry_category_match(self):
        """Ensure geometry type is compatible with feature category."""
        category = self.properties.category
        geo_type = self.geometry.type
        
        allowed = GEOMETRY_CATEGORY_MAP.get(category, [])
        if allowed and geo_type not in allowed:
            raise ValueError(
                f'Category {category} requires geometry type in {allowed}, '
                f'got {geo_type}'
            )
        return self


class PlanFeatureCollection(BaseModel):
    """GeoJSON FeatureCollection wrapper for Plan features.
    
    Contains all markers, routes, and areas defined in a Plan.
    """
    type: str = "FeatureCollection"
    features: List[PlanFeature] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


# =============================================================================
# Phase 2 - Module D: Logistics & Team Management (FR-D01, FR-D02, FR-D03)
# =============================================================================

class RosterMember(BaseModel):
    """Team member entry for expedition roster (FR-D01).
    
    Stores contact information and role for each team member.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: Optional[str] = None  # e.g., "Leader", "Navigator", "First Aid"
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None  # Emergency contact info
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class LogisticsInfo(BaseModel):
    """Logistics and transportation details (FR-D02).
    
    Stores information about transport, insurance, and communication.
    """
    transport_provider: Optional[str] = None  # Shuttle/taxi company
    driver_phone: Optional[str] = None
    pickup_location: Optional[str] = None
    pickup_time: Optional[datetime] = None
    dropoff_location: Optional[str] = None
    dropoff_time: Optional[datetime] = None
    insurance_policy: Optional[str] = None  # Policy number or details
    insurance_provider: Optional[str] = None
    radio_channel: Optional[str] = None  # For group communication
    emergency_contacts: Optional[str] = None  # Park ranger, rescue team, etc.
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class GearCategory(str, Enum):
    """Gear category classification (FR-D03)."""
    GROUP = "group"       # Shared group gear
    PERSONAL = "personal" # Individual gear
    SAFETY = "safety"     # Safety equipment
    COOKING = "cooking"   # Cooking/food gear
    SHELTER = "shelter"   # Tent/tarp/bivvy


class GearItem(BaseModel):
    """Individual gear checklist item (FR-D03).
    
    Supports tracking of group and personal equipment.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: GearCategory = Field(default=GearCategory.PERSONAL)
    item_name: str
    quantity: int = Field(default=1, ge=1)
    weight_grams: Optional[int] = None  # Weight in grams
    is_checked: bool = Field(default=False)  # Packed/verified status
    assigned_to: Optional[str] = None  # Member name or ID responsible
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


# =============================================================================
# Phase 2 - Module B: Structured Itinerary (FR-B01, FR-B02, FR-B03)
# =============================================================================

class DaySummary(BaseModel):
    """Summary information for a single day in the itinerary (FR-B02).
    
    Each day in the expedition can have:
    - A descriptive summary of the route
    - Weather/condition notes
    - Distance/elevation stats (computed or manual)
    """
    day_number: int = Field(ge=1)  # Day 1, Day 2, etc.
    date: Optional[datetime] = None  # Actual date if known
    title: Optional[str] = None  # e.g., "Summit Day", "Approach"
    route_summary: Optional[str] = None  # FR-B02: Route overview text
    conditions: Optional[str] = None  # FR-B02: Weather/trail conditions
    distance_km: Optional[float] = None  # Planned distance
    elevation_gain_m: Optional[int] = None  # Planned ascent
    elevation_loss_m: Optional[int] = None  # Planned descent
    notes: Optional[str] = None

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
        status: Lifecycle status (draft, active, archived).
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
    
    # ==========================================================================
    # Phase 2 - Module D: Logistics & Team Management
    # ==========================================================================
    roster: List[RosterMember] = Field(default_factory=list)  # FR-D01: Team roster
    logistics: LogisticsInfo = Field(default_factory=LogisticsInfo)  # FR-D02: Logistics info
    checklist: List[GearItem] = Field(default_factory=list)  # FR-D03: Gear checklist
    
    # ==========================================================================
    # Phase 2 - Module B: Structured Itinerary
    # ==========================================================================
    day_summaries: List[DaySummary] = Field(default_factory=list)  # FR-B02: Day summaries
    
    # Lifecycle
    status: PlanStatus = Field(default=PlanStatus.DRAFT)
    
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


# =============================================================================
# Phase 2 - Module D & B: Logistics & Itinerary Update Payloads
# =============================================================================

class LogisticsUpdate(BaseModel):
    """Payload for updating logistics-related data (PUT /plans/{id}/logistics).
    
    Allows atomic updates to roster, logistics, and checklist without
    sending the entire plan payload.
    """
    roster: Optional[List[RosterMember]] = None
    logistics: Optional[LogisticsInfo] = None
    checklist: Optional[List[GearItem]] = None


class DaySummariesUpdate(BaseModel):
    """Payload for updating day summaries (PUT /plans/{id}/days).
    
    Allows atomic updates to itinerary structure.
    """
    day_summaries: List[DaySummary]


# =============================================================================
# GPX Ingestion Models (for Time Shift feature)
# =============================================================================

class GpxIngestionStrategy(str, Enum):
    """Strategy for applying GPX timestamps to plan."""
    RELATIVE_TIME_SHIFT = "relative"  # Shift all times relative to new plan start
    ABSOLUTE_TIMES = "absolute"       # Keep original GPX timestamps
    NO_TIMES = "no_times"             # Ignore timestamps, use order only


class DetectedWaypoint(BaseModel):
    """Waypoint detected from GPX parsing."""
    # Prefer GPX waypoint note/description as the logical name for plan checkpoints
    name: Optional[str] = None
    note: Optional[str] = None
    lat: float
    lon: float
    ele: Optional[float] = None
    time: Optional[datetime] = None


class GpxIngestionPreview(BaseModel):
    """Response from GPX ingestion endpoint."""
    temp_file_key: str
    track_geometry: Optional[GeoJSONGeometry] = None  # GeoJSON LineString for preview
    track_summary: Dict[str, Any]
    detected_waypoints: List[DetectedWaypoint]
    gpx_start_time: Optional[datetime] = None
    gpx_end_time: Optional[datetime] = None


class GpxStrategyPayload(BaseModel):
    """Strategy selection for creating plan from GPX."""
    temp_file_key: str
    mode: GpxIngestionStrategy = GpxIngestionStrategy.RELATIVE_TIME_SHIFT
    selected_waypoint_indices: Optional[List[int]] = None  # If None, import all


class PlanCreateWithGpx(PlanCreate):
    """Extended plan creation with GPX strategy."""
    gpx_strategy: Optional[GpxStrategyPayload] = None


class ImportTripRequest(BaseModel):
    """Payload for cloning a Trip into a Plan."""
    name: str
    planned_start_date: Optional[datetime] = None
    gpx_strategy: Optional[GpxStrategyPayload] = None
