import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.models.dashboard import (
    ActivityHeatmap,
    CountStats,
    DistanceStats,
    DurationStats,
    ElevationProfilePoint,
    ElevationStats,
    RestPoint,
    SpeedStats,
    TripDashboardResponse,
    TripStatistics,
)
from src.services.file_retrieval_service import FileRetrievalService
from src.services.gpx_analysis_retrieval_service import GpxAnalysisRetrievalService
from src.services.trip_service import TripService

_DISTANCE_TO_MILES = 0.621371
_DEFAULT_ANALYSIS_BUCKET = "gps-analysis-data"


class DashboardService:
    """Aggregate dashboard-ready analytics for a trip."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.trip_service = TripService()
        self.file_service = FileRetrievalService()
        self.analysis_retrieval = GpxAnalysisRetrievalService()

    def get_trip_dashboard(self, trip_id: str) -> TripDashboardResponse:
        """Compile dashboard payload for a trip."""
        trip = self.trip_service.get_trip(trip_id)
        if not trip:
            raise ValueError("Trip not found")

        gpx_files = self.file_service.list_files_with_metadata("gps-data", trip_id=trip_id)
        photo_files = self.file_service.list_files_with_metadata("images", trip_id=trip_id)

        stats = self._build_statistics(gpx_files, photo_files)
        elevation_profile, rest_points = self._build_elevation_and_rest_points(gpx_files)
        heatmap = self._build_activity_heatmap(photo_files)

        return TripDashboardResponse(
            trip_id=trip_id,
            statistics=stats,
            elevation_profile=elevation_profile,
            activity_heatmap=heatmap,
            rest_points=rest_points,
        )

    # ---------------------------------------------------------------------
    # Statistics helpers
    # ---------------------------------------------------------------------

    def _build_statistics(
        self,
        gpx_files: Sequence[Dict[str, Any]],
        photo_files: Sequence[Dict[str, Any]],
    ) -> TripStatistics:
        total_distance_km = 0.0
        total_elevation_gain = 0.0
        total_elevation_loss = 0.0
        max_elevation: Optional[float] = None
        min_elevation: Optional[float] = None
        total_duration_seconds = 0.0
        total_rest_seconds = 0.0
        max_velocity_mps: Optional[float] = None
        rest_points_count = 0
        waypoint_count = 0
        start_times: List[datetime] = []
        end_times: List[datetime] = []

        for entry in gpx_files:
            metadata = entry.get("metadata") or {}
            summary = metadata.get("track_summary") or {}

            total_distance_km += self._safe_float(summary.get("total_distance_km"))
            total_elevation_gain += self._safe_float(summary.get("elevation_gain_m"))
            total_elevation_loss += self._safe_float(summary.get("elevation_loss_m"))
            total_duration_seconds += self._safe_float(summary.get("duration_seconds"))
            total_rest_seconds += self._safe_float(summary.get("total_rest_duration_seconds"))
            rest_points_count += int(summary.get("rest_points_count") or 0)
            waypoint_count += int(summary.get("waypoints_count") or 0)

            max_velocity = self._to_optional_float(summary.get("max_velocity_mps"))
            if max_velocity is not None:
                max_velocity_mps = max(max_velocity_mps or 0, max_velocity)

            summary_max = self._to_optional_float(summary.get("max_elevation_m"))
            summary_min = self._to_optional_float(summary.get("min_elevation_m"))
            if summary_max is not None:
                max_elevation = summary_max if max_elevation is None else max(max_elevation, summary_max)
            if summary_min is not None:
                min_elevation = summary_min if min_elevation is None else min(min_elevation, summary_min)

            start_time = self._parse_iso_datetime(summary.get("start_time"))
            end_time = self._parse_iso_datetime(summary.get("end_time"))
            if start_time:
                start_times.append(start_time)
            if end_time:
                end_times.append(end_time)

        distance_stats = DistanceStats(
            km=self._round_if_value(total_distance_km),
            mi=self._round_if_value(total_distance_km * _DISTANCE_TO_MILES),
        )
        elevation_stats = ElevationStats(
            gain=self._round_if_value(total_elevation_gain),
            loss=self._round_if_value(total_elevation_loss),
            max=self._round_if_value(max_elevation),
            min=self._round_if_value(min_elevation),
            net=self._round_if_value(total_elevation_gain - total_elevation_loss)
            if total_elevation_gain or total_elevation_loss
            else None,
        )

        total_seconds = total_duration_seconds or None
        rest_seconds = total_rest_seconds or None
        moving_seconds = (
            total_seconds - rest_seconds
            if total_seconds is not None and rest_seconds is not None
            else None
        )

        duration_stats = DurationStats(
            total_seconds=self._round_if_value(total_seconds),
            rest_seconds=self._round_if_value(rest_seconds),
            moving_seconds=self._round_if_value(moving_seconds),
            formatted=self._format_duration(total_seconds),
        )

        average_kmh = self._compute_speed_kmh(total_distance_km, total_seconds)
        moving_average_kmh = self._compute_speed_kmh(total_distance_km, moving_seconds)
        speed_stats = SpeedStats(
            average_kmh=self._round_if_value(average_kmh),
            moving_average_kmh=self._round_if_value(moving_average_kmh),
            max_kmh=self._round_if_value(max_velocity_mps * 3.6) if max_velocity_mps is not None else None,
        )

        photo_count = sum(1 for entry in photo_files if entry.get("metadata"))
        geotagged_count = sum(
            1
            for entry in photo_files
            if self._has_geotag(entry.get("metadata"))
        )
        count_stats = CountStats(
            photos=photo_count,
            geotagged_photos=geotagged_count,
            waypoints=waypoint_count,
            rest_points=rest_points_count,
        )

        statistics = TripStatistics(
            distance=distance_stats,
            elevation=elevation_stats,
            duration=duration_stats,
            speed=speed_stats,
            counts=count_stats,
            start_time=min(start_times).isoformat() if start_times else None,
            end_time=max(end_times).isoformat() if end_times else None,
        )
        return statistics

    # ---------------------------------------------------------------------
    # Elevation + rest points helpers
    # ---------------------------------------------------------------------

    def _build_elevation_and_rest_points(
        self,
        gpx_files: Sequence[Dict[str, Any]],
    ) -> Tuple[List[ElevationProfilePoint], List[RestPoint]]:
        primary = next(
            (
                entry
                for entry in gpx_files
                if (entry.get("metadata") or {}).get("analysis_object_key")
            ),
            None,
        )
        if not primary:
            return [], []

        metadata = primary.get("metadata") or {}
        analysis_key = metadata.get("analysis_object_key")
        analysis_bucket = metadata.get("analysis_bucket") or _DEFAULT_ANALYSIS_BUCKET
        if not analysis_key:
            return [], []

        try:
            analyzed_track = self.analysis_retrieval.get_analyzed_track(
                analysis_key,
                analysis_bucket,
            )
        except Exception as exc:  # pragma: no cover - defensive
            self.logger.warning(
                "Failed to load analyzed track %s from %s: %s",
                analysis_key,
                analysis_bucket,
                exc,
            )
            return [], []
        if analyzed_track is None:
            return [], []

        profile: List[ElevationProfilePoint] = []
        rest_points: List[RestPoint] = []
        distance_lookup: List[Tuple[datetime, float]] = []
        cumulative_distance_km = 0.0

        try:
            track_points = (
                analyzed_track.get_main_tracks().get_main_tracks_points_list()  # type: ignore[attr-defined]
            )
        except Exception as exc:  # pragma: no cover - defensive
            self.logger.warning("Unable to read analyzed track points: %s", exc)
            track_points = []

        for idx, point in enumerate(track_points):
            if idx > 0:
                delta = point.get_delta_xy() or 0.0
                cumulative_distance_km += delta / 1000.0

            timestamp = getattr(point, "time", None)
            iso_time = timestamp.isoformat() if timestamp else None
            profile.append(
                ElevationProfilePoint(
                    distance_km=self._round_if_value(cumulative_distance_km, digits=3) or 0.0,
                    elevation_m=self._round_if_value(self._to_optional_float(point.elev)),
                    lat=self._to_optional_float(point.lat),
                    lon=self._to_optional_float(point.lon),
                    time=iso_time,
                )
            )
            if timestamp:
                distance_lookup.append((timestamp, cumulative_distance_km))

        raw_rest_points = self.analysis_retrieval.extract_rest_points(analyzed_track)
        for rest in raw_rest_points:
            start_time_str = rest.get("start_time")
            start_time = self._parse_iso_datetime(start_time_str)
            rest_points.append(
                RestPoint(
                    lat=rest.get("lat"),
                    lon=rest.get("lon"),
                    elev=rest.get("elev"),
                    start_time=start_time_str,
                    end_time=rest.get("end_time"),
                    duration_minutes=rest.get("rest_minutes"),
                    distance_from_start_km=self._round_if_value(
                        self._distance_for_time(distance_lookup, start_time),
                        digits=3,
                    ),
                )
            )

        return profile, rest_points

    # ---------------------------------------------------------------------
    # Activity heatmap helper
    # ---------------------------------------------------------------------

    def _build_activity_heatmap(
        self,
        photo_files: Sequence[Dict[str, Any]],
    ) -> ActivityHeatmap:
        counts = [0 for _ in range(24)]
        for entry in photo_files:
            metadata = entry.get("metadata") or {}
            captured_at = self._parse_iso_datetime(metadata.get("captured_at"))
            if not captured_at:
                continue
            counts[captured_at.hour] += 1

        peak_count = max(counts) if counts else 0
        peak_hour = counts.index(peak_count) if peak_count else None
        return ActivityHeatmap(
            photo_counts_by_hour=counts,
            peak_hour=peak_hour,
            peak_count=peak_count if peak_count else None,
        )

    # ---------------------------------------------------------------------
    # Utility helpers
    # ---------------------------------------------------------------------

    @staticmethod
    def _safe_float(value: Any) -> float:
        try:
            if value is None:
                return 0.0
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _round_if_value(value: Optional[float], digits: int = 2) -> Optional[float]:
        if value is None:
            return None
        return round(value, digits)

    @staticmethod
    def _to_optional_float(value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            cleaned = value.replace("Z", "+00:00") if isinstance(value, str) else value
            return datetime.fromisoformat(cleaned)
        except ValueError:
            return None

    @staticmethod
    def _format_duration(value: Optional[float]) -> Optional[str]:
        if value is None or value <= 0:
            return None
        total_seconds = int(value)
        hours, remainder = divmod(total_seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        parts = []
        if hours:
            parts.append(f"{hours}h")
        if minutes or not parts:
            parts.append(f"{minutes}m")
        return " ".join(parts)

    @staticmethod
    def _compute_speed_kmh(distance_km: float, seconds: Optional[float]) -> Optional[float]:
        if not distance_km or not seconds or seconds <= 0:
            return None
        return distance_km / (seconds / 3600.0)

    @staticmethod
    def _has_geotag(metadata: Optional[Dict[str, Any]]) -> bool:
        if not metadata:
            return False
        gps = metadata.get("gps") or {}
        return gps.get("latitude") is not None and gps.get("longitude") is not None

    @staticmethod
    def _distance_for_time(
        distance_lookup: Sequence[Tuple[datetime, float]],
        target_time: Optional[datetime],
    ) -> Optional[float]:
        if not distance_lookup or not target_time:
            return None
        last_distance: Optional[float] = None
        for timestamp, distance in distance_lookup:
            if timestamp <= target_time:
                last_distance = distance
            else:
                break
        return last_distance
