from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class AnnotationMood(str, Enum):
    HAPPY = "happy"
    TIRED = "tired"
    EXCITED = "excited"
    AMAZED = "amazed"
    PEACEFUL = "peaceful"
    ANXIOUS = "anxious"
    OTHER = "other"


class AnnotationActivity(str, Enum):
    HIKING = "hiking"
    RESTING = "resting"
    EATING = "eating"
    CAMPING = "camping"
    CLIMBING = "climbing"
    SWIMMING = "swimming"
    CYCLING = "cycling"
    OTHER = "other"


class AnnotationWeather(str, Enum):
    SUNNY = "sunny"
    CLOUDY = "cloudy"
    PARTLY_CLOUDY = "partly_cloudy"
    RAINY = "rainy"
    FOGGY = "foggy"
    SNOWY = "snowy"
    WINDY = "windy"


class AnnotationVisibility(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class AnnotationWind(str, Enum):
    CALM = "calm"
    LIGHT = "light"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


class AnnotationPrecipitation(str, Enum):
    NONE = "none"
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"


class AnnotationPrivacy(str, Enum):
    PUBLIC = "public"
    FRIENDS = "friends"
    PRIVATE = "private"


class AnnotationListMergeMode(str, Enum):
    APPEND = "append"
    REPLACE = "replace"


def _default_list() -> List[str]:
    return []


class PhotoAnnotations(BaseModel):
    """Structured annotation fields that augment user notes."""

    model_config = ConfigDict(extra="forbid")

    tags: Optional[List[str]] = None
    mood: Optional[AnnotationMood] = None
    activity: Optional[AnnotationActivity] = None
    weather: Optional[AnnotationWeather] = None
    difficulty: Optional[int] = Field(default=None, ge=1, le=5)
    visibility: Optional[AnnotationVisibility] = None
    temperature: Optional[float] = None
    wind: Optional[AnnotationWind] = None
    precipitation: Optional[AnnotationPrecipitation] = None
    companions: Optional[List[str]] = None
    gear: Optional[List[str]] = None
    location_name: Optional[str] = None
    reference_url: Optional[str] = None
    private_notes: Optional[str] = None
    activity_detail: Optional[str] = None
    is_first_summit: Optional[bool] = None
    is_personal_record: Optional[bool] = None
    is_trip_highlight: Optional[bool] = None
    is_bucket_list: Optional[bool] = None
    quality_rating: Optional[int] = Field(default=None, ge=1, le=5)
    privacy: Optional[AnnotationPrivacy] = None


class PhotoAnnotationsPatch(PhotoAnnotations):
    """Partial update payload for annotations."""

    model_config = ConfigDict(extra="forbid")


class BulkAnnotationPayload(BaseModel):
    """Request payload for bulk annotation updates."""

    metadata_ids: List[str]
    annotations: PhotoAnnotationsPatch
    tag_mode: AnnotationListMergeMode = AnnotationListMergeMode.APPEND
    companion_mode: AnnotationListMergeMode = AnnotationListMergeMode.APPEND
    gear_mode: AnnotationListMergeMode = AnnotationListMergeMode.APPEND
    annotated_by: Optional[str] = None
    auto_annotated: Optional[bool] = None


class AnnotationUpdatePayload(BaseModel):
    """Single-file annotation update payload."""

    annotations: PhotoAnnotationsPatch
    annotated_by: Optional[str] = None
    auto_annotated: Optional[bool] = None
