from __future__ import annotations

import logging
import pickle
from typing import Any, Dict, List, Optional

from geo_objects.geo_tracks.analyzed_geo_tracks import AnalyzedTrackObject

from src.models.file_metadata import FileMetadata
from src.services.gpx_analysis_service import GpxAnalysisService
from src.services.service_dependencies import ensure_storage_manager
from src.utils.dbbutler.storage_manager import StorageManager


class GpxAnalysisRetrievalService:
    """Load persisted GPX analysis artifacts and summaries."""

    def __init__(self, storage_manager: StorageManager | None = None) -> None:
        self.logger = logging.getLogger(__name__)
        self.storage_manager = ensure_storage_manager(
            storage_manager,
            include_minio=True,
            include_mongodb=True,
        )

    def get_analyzed_track(
        self,
        analysis_object_key: str,
        analysis_bucket: str = "gps-analysis-data"
    ) -> Optional[AnalyzedTrackObject]:
        """
        Retrieve and deserialize an analyzed track object from MinIO.
        """
        if 'minio' not in self.storage_manager.adapters:
            raise RuntimeError("MinIO adapter not configured")

        data = self.storage_manager.load_data('minio', analysis_object_key, bucket=analysis_bucket)
        if data is None:
            return None

        try:
            return pickle.loads(data)
        except Exception as exc:
            self.logger.error("Failed to deserialize analyzed track %s: %s", analysis_object_key, exc)
            raise

    def get_track_summary(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """
        Return the stored track summary from metadata without loading the full pickle.
        """
        mongodb_adapter = self.storage_manager.adapters.get('mongodb')
        if not mongodb_adapter:
            raise RuntimeError("MongoDB adapter not configured")

        document = mongodb_adapter.load_data(
            metadata_id,
            collection_name='file_metadata'
        )
        if not document:
            return None

        try:
            parsed = FileMetadata(**document)
            return parsed.track_summary
        except Exception as exc:
            self.logger.warning("Failed to parse metadata for %s: %s", metadata_id, exc)
            return document.get('track_summary')

    @staticmethod
    def extract_coordinates(analyzed_track: AnalyzedTrackObject) -> List[List[float]]:
        """Convert analyzed track points into Leaflet-friendly [lat, lon] arrays."""
        try:
            points = analyzed_track.get_main_tracks().get_main_tracks_points_list()  # type: ignore[attr-defined]
        except Exception:
            return []

        coords: List[List[float]] = []
        for point in points:
            if point.lat is None or point.lon is None:
                continue
            coords.append([float(point.lat), float(point.lon)])
        return coords

    @staticmethod
    def extract_waypoints(analyzed_track: AnalyzedTrackObject) -> List[Dict[str, Any]]:
        """Extract waypoint information from an analyzed track."""
        waypoints = []
        try:
            raw_waypoints = analyzed_track.get_waypoint_list() or []
        except Exception:
            raw_waypoints = []

        for wp in raw_waypoints:
            if wp.lat is None or wp.lon is None:
                continue
            waypoints.append(
                {
                    "lat": float(wp.lat),
                    "lon": float(wp.lon),
                    "elev": float(wp.elev) if wp.elev is not None else None,
                    "time": wp.time.isoformat() if hasattr(wp, "time") and wp.time else None,
                    "note": getattr(wp, "get_note", lambda: None)(),
                }
            )
        return waypoints

    @staticmethod
    def extract_rest_points(analyzed_track: AnalyzedTrackObject) -> List[Dict[str, Any]]:
        """Extract rest point information from an analyzed track."""
        rest_points = []
        try:
            raw_rest_points = analyzed_track.get_rest_point_list() or []
        except Exception:
            raw_rest_points = []

        for rp in raw_rest_points:
            if rp.lat is None or rp.lon is None:
                continue
            rest_points.append(
                {
                    "lat": float(rp.lat),
                    "lon": float(rp.lon),
                    "elev": float(rp.elev) if rp.elev is not None else None,
                    "start_time": rp.get_start_time().isoformat() if hasattr(rp, "get_start_time") and rp.get_start_time() else None,
                    "end_time": rp.get_end_time().isoformat() if hasattr(rp, "get_end_time") and rp.get_end_time() else None,
                    "rest_minutes": rp.get_rest_time_spend() if hasattr(rp, "get_rest_time_spend") else None,
                }
            )
        return rest_points

    def build_track_payload(
        self,
        analyzed_track: AnalyzedTrackObject,
        metadata_summary: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Return a serializable payload from an analyzed track object."""
        summary = metadata_summary or GpxAnalysisService.extract_track_summary(analyzed_track)
        
        # Ensure elevation profile is present (for backward compatibility with old metadata)
        if 'elevation_profile' not in summary:
            full_summary = GpxAnalysisService.extract_track_summary(analyzed_track)
            summary['elevation_profile'] = full_summary.get('elevation_profile')

        return {
            "coordinates": self.extract_coordinates(analyzed_track),
            "waypoints": self.extract_waypoints(analyzed_track),
            "rest_points": self.extract_rest_points(analyzed_track),
            "track_summary": summary,
        }
