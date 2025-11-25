from typing import List, Optional
from pydantic import BaseModel


class DistanceStats(BaseModel):
    km: Optional[float] = None
    mi: Optional[float] = None


class ElevationStats(BaseModel):
    gain: Optional[float] = None
    loss: Optional[float] = None
    max: Optional[float] = None
    min: Optional[float] = None
    net: Optional[float] = None


class DurationStats(BaseModel):
    total_seconds: Optional[float] = None
    moving_seconds: Optional[float] = None
    rest_seconds: Optional[float] = None
    formatted: Optional[str] = None


class SpeedStats(BaseModel):
    average_kmh: Optional[float] = None
    moving_average_kmh: Optional[float] = None
    max_kmh: Optional[float] = None


class CountStats(BaseModel):
    photos: int = 0
    geotagged_photos: int = 0
    waypoints: int = 0
    rest_points: int = 0


class TripStatistics(BaseModel):
    distance: DistanceStats
    elevation: ElevationStats
    duration: DurationStats
    speed: SpeedStats
    counts: CountStats
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class ElevationProfilePoint(BaseModel):
    distance_km: float
    elevation_m: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    time: Optional[str] = None


class ActivityHeatmap(BaseModel):
    photo_counts_by_hour: List[int]
    peak_hour: Optional[int] = None
    peak_count: Optional[int] = None


class RestPoint(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    elev: Optional[float] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[float] = None
    distance_from_start_km: Optional[float] = None


class TripDashboardResponse(BaseModel):
    trip_id: str
    statistics: TripStatistics
    elevation_profile: List[ElevationProfilePoint]
    activity_heatmap: ActivityHeatmap
    rest_points: List[RestPoint]
