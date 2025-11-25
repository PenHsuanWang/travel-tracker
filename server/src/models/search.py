from __future__ import annotations

from datetime import date
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from src.models.annotations import (
    AnnotationActivity,
    AnnotationMood,
    AnnotationWeather,
    AnnotationPrivacy,
    PhotoAnnotations,
)
from src.models.file_metadata import GPSData


class SearchSortField(str, Enum):
    """Sortable fields exposed by the photo search API."""

    CAPTURED_AT = "captured_at"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    ANNOTATED_AT = "annotated_at"


class SortOrder(str, Enum):
    """Sort direction for query results."""

    ASC = "asc"
    DESC = "desc"


class SearchFilters(BaseModel):
    """Filter options supported by the advanced search endpoint."""

    query: Optional[str] = None
    tags: Optional[List[str]] = None
    mood: Optional[List[AnnotationMood]] = None
    activity: Optional[List[AnnotationActivity]] = None
    weather: Optional[List[AnnotationWeather]] = None
    privacy: Optional[List[AnnotationPrivacy]] = None
    companions: Optional[List[str]] = None
    gear: Optional[List[str]] = None
    has_gps: Optional[bool] = None
    has_notes: Optional[bool] = None
    has_annotations: Optional[bool] = None
    only_highlights: Optional[bool] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    altitude_min: Optional[float] = None
    altitude_max: Optional[float] = None
    near_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    near_lon: Optional[float] = Field(default=None, ge=-180, le=180)
    near_radius_km: Optional[float] = Field(default=None, gt=0, le=500)
    quality_rating_min: Optional[int] = Field(default=None, ge=1, le=5)
    quality_rating_max: Optional[int] = Field(default=None, ge=1, le=5)
    difficulty_min: Optional[int] = Field(default=None, ge=1, le=5)
    difficulty_max: Optional[int] = Field(default=None, ge=1, le=5)


class SearchRequest(BaseModel):
    """Search payload that the frontend sends to the backend."""

    trip_id: str
    filters: SearchFilters = Field(default_factory=SearchFilters)
    sort_by: SearchSortField = SearchSortField.CAPTURED_AT
    sort_order: SortOrder = SortOrder.ASC
    offset: int = Field(default=0, ge=0, le=5000)
    limit: int = Field(default=50, ge=1, le=200)


class SearchResultItem(BaseModel):
    """Slim projection of photo metadata returned to the UI."""

    metadata_id: str
    object_key: str
    bucket: str
    thumbnail_url: str
    captured_at: Optional[str] = None
    created_at: Optional[str] = None
    annotated_at: Optional[str] = None
    last_edited_at: Optional[str] = None
    note_title: Optional[str] = None
    note: Optional[str] = None
    annotations: Optional[PhotoAnnotations] = None
    gps: Optional[GPSData] = None
    mood: Optional[AnnotationMood] = None
    activity: Optional[AnnotationActivity] = None
    weather: Optional[AnnotationWeather] = None
    score: Optional[float] = None


class SearchResponse(BaseModel):
    """Normalized API response for photo search."""

    results: List[SearchResultItem]
    total: int
    limit: int
    offset: int
    has_more: bool
    took_ms: int


class SearchPresetBase(BaseModel):
    """Shared fields for search preset create/update operations."""

    name: str = Field(..., min_length=1, max_length=80)
    filters: SearchFilters = Field(default_factory=SearchFilters)
    sort_by: SearchSortField = SearchSortField.CAPTURED_AT
    sort_order: SortOrder = SortOrder.ASC


class SearchPresetCreateRequest(SearchPresetBase):
    """Payload for creating a new preset."""

    trip_id: str
    user_id: Optional[str] = None


class SearchPresetUpdateRequest(SearchPresetBase):
    """Payload for updating an existing preset."""

    user_id: Optional[str] = None


class SearchPresetResponse(SearchPresetBase):
    """Preset payload sent back to clients."""

    id: str
    trip_id: str
    user_id: Optional[str] = None
    created_at: str
    updated_at: str
