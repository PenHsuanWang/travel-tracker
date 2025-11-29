import logging
import os
import pickle
import tempfile
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from gpxana import GpxParser, TrackAnalyzer
from geo_objects.geo_points.analyzed_geo_points import AnalyzedTrkPoint, RestTrkPoint
from geo_objects.geo_tracks.analyzed_geo_tracks import AnalyzedTrackObject

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Container for analysis artifacts returned by GpxAnalysisService."""
    analyzed_track: AnalyzedTrackObject
    serialized_object: bytes
    summary: Dict[str, Any]


class GpxAnalysisService:
    """Service that parses GPX bytes, runs analysis, and prepares artifacts."""

    @staticmethod
    def analyze_gpx_data(gpx_bytes: bytes, filename: str) -> AnalysisResult:
        """
        Parse and analyze GPX data.

        The underlying gpxana parser requires a filesystem path, so the bytes are
        written to a temporary file before parsing.
        """
        if gpx_bytes is None:
            raise ValueError("GPX payload is required")

        tmp_path: Optional[str] = None
        try:
            suffix = os.path.splitext(filename)[1] or ".gpx"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(gpx_bytes)
                tmp_path = tmp_file.name

            parser = GpxParser(tmp_path)
            raw_track = parser.get_raw_track_object()
            analyzer = TrackAnalyzer(raw_track)

            analyzed_track = getattr(analyzer, "_analyzed_tracks_object", None)
            if analyzed_track is None:
                raise RuntimeError("TrackAnalyzer did not produce an analyzed track object")

            summary = GpxAnalysisService.extract_track_summary(analyzed_track)
            serialized_object = pickle.dumps(analyzed_track)

            return AnalysisResult(
                analyzed_track=analyzed_track,
                serialized_object=serialized_object,
                summary=summary
            )
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    logger.warning("Failed to clean up temp GPX file %s", tmp_path)

    @staticmethod
    def extract_track_summary(analyzed_track: AnalyzedTrackObject) -> Dict[str, Any]:
        """Extract lightweight, serializable stats from an analyzed track."""
        try:
            track_points: List[AnalyzedTrkPoint] = analyzed_track.get_main_tracks().get_main_tracks_points_list()  # type: ignore[attr-defined]
        except Exception as exc:
            logger.warning("Unable to read analyzed track points: %s", exc)
            return {}

        if not track_points:
            return {}

        total_distance_m = 0.0
        elevation_gain_m = 0.0
        elevation_loss_m = 0.0
        speeds_mps: List[float] = []
        latitudes: List[float] = []
        longitudes: List[float] = []
        elevations: List[float] = []
        
        # For elevation profile: list of [distance_m, elevation_m]
        profile_points: List[List[float]] = []
        current_dist = 0.0

        for point in track_points:
            delta_xy = point.get_delta_xy()
            total_distance_m += delta_xy
            current_dist += delta_xy

            dt = point.get_point_delta_time()
            if dt and dt > 0:
                speeds_mps.append(delta_xy / dt)

            delta_z = point.get_delta_z()
            if delta_z is not None:
                if delta_z > 0:
                    elevation_gain_m += delta_z
                elif delta_z < 0:
                    elevation_loss_m += abs(delta_z)
            
            # Collect lat/lon for bounding box
            if point.lat is not None:
                latitudes.append(point.lat)
            if point.lon is not None:
                longitudes.append(point.lon)

            # Collect elevation for profile
            # Use point.elevation if available, otherwise try to infer or skip
            # AnalyzedTrkPoint usually wraps a TrkPoint which has elevation
            elev = point.elevation if hasattr(point, 'elevation') else None
            # If point doesn't have elevation directly, check if we can get it from the raw point
            if elev is None and hasattr(point, 'raw_point') and hasattr(point.raw_point, 'elevation'):
                 elev = point.raw_point.elevation
            
            if elev is not None:
                elevations.append(elev)
                profile_points.append([round(current_dist, 1), round(elev, 1)])
            elif point.elev is not None: # Fallback to point.elev if available
                elevations.append(point.elev)
                profile_points.append([round(current_dist, 1), round(point.elev, 1)])


        # Downsample profile if too large (target ~200 points)
        target_points = 200
        if len(profile_points) > target_points:
            step = len(profile_points) / target_points
            downsampled = []
            for i in range(target_points):
                idx = int(i * step)
                if idx < len(profile_points):
                    downsampled.append(profile_points[idx])
            # Ensure last point is included
            if profile_points[-1] not in downsampled:
                downsampled.append(profile_points[-1])
            profile_points = downsampled

        start_time = track_points[0].time
        end_time = track_points[-1].time
        duration_seconds: Optional[float] = None
        if start_time and end_time:
            duration_seconds = (end_time - start_time).total_seconds()

        rest_points: List[RestTrkPoint] = []
        try:
            rest_points = analyzed_track.get_rest_point_list()
        except Exception:
            rest_points = []

        total_rest_duration_seconds = 0.0
        for rest_point in rest_points:
            try:
                total_rest_duration_seconds += float(rest_point.get_rest_time_spend() * 60)
            except Exception:
                continue

        summary: Dict[str, Any] = {
            "total_points": len(track_points),
            "total_distance_m": total_distance_m,
            "total_distance_km": total_distance_m / 1000 if total_distance_m else 0,
            "duration_seconds": duration_seconds,
            "start_time": start_time.isoformat() if start_time else None,
            "end_time": end_time.isoformat() if end_time else None,
            "elevation_gain_m": elevation_gain_m or 0,
            "elevation_loss_m": elevation_loss_m or 0,
            "max_elevation_m": max(elevations) if elevations else None,
            "min_elevation_m": min(elevations) if elevations else None,
            "average_velocity_mps": (total_distance_m / duration_seconds) if duration_seconds else None,
            "max_velocity_mps": max(speeds_mps) if speeds_mps else None,
            "rest_points_count": len(rest_points),
            "total_rest_duration_seconds": total_rest_duration_seconds,
            "waypoints_count": len(analyzed_track.get_waypoint_list() or []),
            "turn_points_count": len(getattr(analyzed_track, "get_great_turn_point_list", lambda: [])() or []),
            "elevation_profile": profile_points
        }

        if latitudes and longitudes:
            summary["bounding_box"] = {
                "min_lat": min(latitudes),
                "max_lat": max(latitudes),
                "min_lon": min(longitudes),
                "max_lon": max(longitudes),
            }

        return summary
