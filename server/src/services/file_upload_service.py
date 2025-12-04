"""Upload pipeline services for GPX tracks, photos, and CSVs."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, UploadFile  # type: ignore[import-not-found]

from src.events.event_bus import EventBus
from src.models.file_metadata import FileMetadata, HandlerResult
from src.services.data_io_handlers.handler_factory import HandlerFactory
from src.services.service_dependencies import ensure_storage_manager
from src.services.trip_service import TripService
from src.utils.dbbutler.storage_manager import StorageManager


class FileUploadService:
    """Coordinate handlers, storage adapters, and metadata persistence."""

    def __init__(
        self,
        storage_manager: StorageManager,
        trip_service: TripService,
        handler_factory: type[HandlerFactory] = HandlerFactory,
        event_bus: type[EventBus] = EventBus,
    ) -> None:
        """Initializes the FileUploadService with its dependencies.

        :param storage_manager: A configured StorageManager instance.
        :param trip_service: An instance of the TripService.
        :param handler_factory: A factory for creating file handlers.
        :param event_bus: The application's event bus class.
        """
        self.logger = logging.getLogger(__name__)
        self.storage_manager = storage_manager
        self.trip_service = trip_service
        self.handler_factory = handler_factory
        self.event_bus = event_bus

    # --- GPX date helpers ---
    @staticmethod
    def _parse_iso_datetime(value: Optional[Any]) -> Optional[datetime]:
        """
        Parse an ISO-like timestamp into a datetime. Returns None for invalid inputs.
        """
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        text = str(value)

        candidates = [text]
        if text.endswith("Z"):
            candidates.append(text.replace("Z", "+00:00"))

        for candidate in candidates:
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                continue
        return None

    @classmethod
    def _extract_gpx_bounds(cls, track_summary: Optional[Dict[str, Any]]) -> Tuple[Optional[datetime], Optional[datetime], bool]:
        """
        Extract start/end timestamps from a track summary produced by GPX analysis.
        Returns (start, end, metadata_extracted).
        """
        if not track_summary or not isinstance(track_summary, dict):
            return None, None, False

        start_dt = cls._parse_iso_datetime(track_summary.get("start_time"))
        end_dt = cls._parse_iso_datetime(track_summary.get("end_time"))
        metadata_extracted = bool(start_dt or end_dt)
        return start_dt, end_dt, metadata_extracted

    @staticmethod
    def _floor_to_date(dt: datetime) -> datetime:
        """Trim a datetime down to midnight. If tz-aware, normalize to UTC then drop tzinfo."""
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc)
        return datetime.combine(dt.date(), datetime.min.time())

    def _maybe_autofill_trip_dates(
        self,
        trip_id: str,
        track_summary: Optional[Dict[str, Any]],
        metadata_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        If the trip has no dates set, populate them from GPX timestamps.
        Returns details for the API response.
        """
        start_dt, end_dt, metadata_extracted = self._extract_gpx_bounds(track_summary)
        result: Dict[str, Any] = {
            "applied": False,
            "reason": None,
            "metadata_extracted": metadata_extracted,
            "start_datetime": start_dt.isoformat() if start_dt else None,
            "end_datetime": end_dt.isoformat() if end_dt else None,
            "activity_start_datetime": None,
            "activity_end_datetime": None,
            "trip": None,
        }

        if not metadata_extracted:
            result["reason"] = "no_timestamps"
            return result

        if not start_dt or not end_dt:
            result["reason"] = "partial_timestamps"
            return result

        try:
            trip = self.trip_service.get_trip(trip_id)
        except Exception as exc:
            self.logger.warning(
                "Trip lookup failed for %s (metadata_id=%s): %s", trip_id, metadata_id, exc
            )
            result["reason"] = "trip_lookup_failed"
            return result

        if not trip:
            result["reason"] = "trip_not_found"
            return result

        activity_start = self._floor_to_date(start_dt)
        activity_end = self._floor_to_date(end_dt)
        result["activity_start_datetime"] = activity_start.isoformat()
        result["activity_end_datetime"] = activity_end.isoformat()

        update_payload = {
            "activity_start_date": activity_start,
            "activity_end_date": activity_end,
        }
        applied = False
        if not trip.start_date:
            update_payload["start_date"] = activity_start
            applied = True
        if not trip.end_date:
            update_payload["end_date"] = activity_end
            applied = True

        updated_trip = self.trip_service.update_trip(trip_id, update_payload)
        if updated_trip:
            result["applied"] = applied
            if not applied and trip.start_date and trip.end_date:
                result["reason"] = "trip_dates_already_set"
            result["trip"] = updated_trip.model_dump(by_alias=True)
        else:
            result["reason"] = "trip_update_failed"
        return result
    
    def _delete_existing_gpx_if_any(self, trip_id: str) -> None:
        """If a GPX file already exists for the trip, delete it."""
        try:
            mongodb_adapter = self.storage_manager.adapters.get('mongodb')
            if mongodb_adapter:
                collection = mongodb_adapter.get_collection('file_metadata')
                cursor = collection.find({"trip_id": trip_id, "file_extension": "gpx"})
                for doc in cursor:
                    try:
                        self._delete_file(doc['_id'], bucket=doc.get('bucket', 'gps-data'))
                        self.logger.info("Deleted existing GPX file %s for trip %s", doc['_id'], trip_id)
                    except Exception as exc:
                        self.logger.warning("Failed to delete existing GPX %s: %s", doc['_id'], exc)
        except Exception as exc:
            self.logger.warning("Error checking/deleting existing GPX files: %s", exc)

    def _persist_metadata(self, result: HandlerResult, uploader_id: str | None, trip_id: str | None) -> FileMetadata:
        """Create and save the FileMetadata document to MongoDB."""
        metadata = FileMetadata(
            id=result.object_key,
            object_key=result.object_key,
            bucket=result.bucket,
            filename=result.filename,
            original_filename=result.original_filename,
            size=result.size,
            mime_type=result.mime_type,
            file_extension=result.file_extension,
            exif=result.exif,
            gps=result.gps,
            date_taken=result.date_taken,
            captured_at=result.captured_at,
            captured_source=result.captured_source,
            camera_make=result.camera_make,
            camera_model=result.camera_model,
            created_at=datetime.now(timezone.utc),
            uploader_id=uploader_id,
            trip_id=trip_id,
            has_gpx_analysis=result.has_gpx_analysis,
            analysis_object_key=result.analysis_object_key,
            analysis_bucket=result.analysis_bucket,
            analysis_status=result.analysis_status,
            analysis_error=result.analysis_error,
            track_summary=result.track_summary,
            status=result.status
        )
        self.storage_manager.save_data(
            result.object_key,
            metadata.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name='file_metadata'
        )
        return metadata

    def _handle_gpx_side_effects(self, result: HandlerResult, trip_id: str, metadata_id: str) -> dict:
        """Auto-fill trip dates and publish events for GPX files."""
        response_updates = {}
        auto_fill_details = self._maybe_autofill_trip_dates(trip_id, result.track_summary, metadata_id)
        response_updates["trip_dates_auto_filled"] = auto_fill_details.get("applied")
        response_updates["auto_fill_reason"] = auto_fill_details.get("reason")
        response_updates["gpx_metadata_extracted"] = auto_fill_details.get("metadata_extracted")
        response_updates["gpx_start_datetime"] = auto_fill_details.get("start_datetime")
        response_updates["gpx_end_datetime"] = auto_fill_details.get("end_datetime")
        response_updates["activity_start_datetime"] = auto_fill_details.get("activity_start_datetime")
        response_updates["activity_end_datetime"] = auto_fill_details.get("activity_end_datetime")
        if auto_fill_details.get("trip"):
            response_updates["trip"] = auto_fill_details["trip"]

        if not result.track_summary:
            return response_updates

        # Update trip stats and publish event for gamification
        try:
            stats_payload = {
                "distance_km": result.track_summary.get("total_distance_km") or (result.track_summary.get("total_distance_m") or 0) / 1000,
                "elevation_gain_m": result.track_summary.get("elevation_gain_m", 0),
                "moving_time_sec": result.track_summary.get("duration_seconds", 0),
                "max_altitude_m": result.track_summary.get("max_elevation_m") or result.track_summary.get("max_altitude_m") or 0,
            }
            self.trip_service.update_trip_stats(trip_id, stats_payload)

            trip = self.trip_service.get_trip(trip_id)
            if trip:
                stats = {
                    "distance_km": result.track_summary.get("total_distance_km", 0),
                    "elevation_gain_m": result.track_summary.get("elevation_gain_m", 0),
                }
                self.event_bus.publish(
                    "GPX_PROCESSED",
                    {"trip_id": trip_id, "stats": stats, "member_ids": trip.member_ids},
                )
        except Exception as exc:
            self.logger.error("Failed to publish GPX_PROCESSED event: %s", exc)

        return response_updates

    def _save_file(
        self,
        file: UploadFile,
        uploader_id: Optional[str] = None,
        trip_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist file bytes, analysis artifacts, and Mongo-backed metadata."""
        file_extension = (file.filename or "").split('.')[-1].lower()
        
        # Enforce trip scoping for GPX and image uploads
        if file_extension == "gpx" and not trip_id:
            raise ValueError("trip_id is required when uploading GPX tracks")
        
        # Enforce single GPX file per trip
        if file_extension == "gpx" and trip_id:
            self._delete_existing_gpx_if_any(trip_id)

        handler = self.handler_factory.get_handler(
            file_extension,
            storage_manager=self.storage_manager,
        )
        result = handler.handle(file, trip_id=trip_id)
        
        if not isinstance(result, HandlerResult):
             return {"filename": file.filename, "status": "unknown", "error": "Unexpected handler result type"}

        metadata = self._persist_metadata(result, uploader_id, trip_id)
        
        response_payload: Dict[str, Any] = {
            "metadata_id": metadata.id,
            "object_key": result.object_key,
            "filename": result.original_filename,
            "file_path": f"{result.bucket}/{result.filename}",
            "size": result.size,
            "mime_type": result.mime_type,
            "has_gps": result.gps is not None,
            "gps": result.gps.model_dump() if result.gps else None,
            "date_taken": result.date_taken,
            "captured_at": result.captured_at.isoformat() if result.captured_at else None,
            "captured_source": result.captured_source,
            "camera_make": result.camera_make,
            "camera_model": result.camera_model,
            "status": result.status,
            "has_gpx_analysis": result.has_gpx_analysis,
            "analysis_status": result.analysis_status,
            "analysis_bucket": result.analysis_bucket,
            "analysis_object_key": result.analysis_object_key,
            "analysis_error": result.analysis_error,
            "track_summary": result.track_summary,
        }

        if file_extension == "gpx" and trip_id:
            gpx_updates = self._handle_gpx_side_effects(result, trip_id, metadata.id)
            response_payload.update(gpx_updates)

        return response_payload

    def upload_file(
        self,
        file: UploadFile,
        uploader_id: Optional[str] = None,
        trip_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Public entry point that reuses the injected storage manager and dependencies."""

        return self._save_file(file, uploader_id, trip_id)

    def save_file(
        self,
        file: UploadFile,
        uploader_id: Optional[str] = None,
        trip_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Alias for upload_file for backward compatibility."""
        return self.upload_file(file, uploader_id, trip_id)

    def get_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Return metadata for a stored object using cached adapters."""

        return self._get_file_metadata(metadata_id)

    def get_file_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Alias for get_metadata for backward compatibility."""
        return self.get_metadata(metadata_id)
    
    def _delete_file(self, filename: str, bucket: str = "images") -> Dict[str, Any]:
        """Remove the object from MinIO and prune its MongoDB metadata."""

        deleted_items = []
        errors = []
        metadata_snapshot: Optional[Dict[str, Any]] = None
        
        # Delete from MinIO
        try:
            minio_adapter = self.storage_manager.adapters.get('minio')
            if minio_adapter:
                # Check if file exists
                if minio_adapter.exists(filename, bucket=bucket):
                    minio_adapter.delete_data(filename, bucket=bucket)
                    deleted_items.append(f"MinIO: {bucket}/{filename}")
                else:
                    errors.append(f"File not found in MinIO: {bucket}/{filename}")
            else:
                errors.append("MinIO adapter not available")
        except Exception as e:
            errors.append(f"MinIO deletion error: {str(e)}")
        
        # Capture metadata before deletion and remove stored document
        try:
            mongodb_adapter = self.storage_manager.adapters.get('mongodb')
            if mongodb_adapter:
                try:
                    snapshot_raw = mongodb_adapter.load_data(
                        filename,
                        collection_name='file_metadata'
                    )
                except Exception as exc:
                    snapshot_raw = None
                    errors.append(f"MongoDB metadata read error: {str(exc)}")

                if snapshot_raw:
                    try:
                        parsed_metadata = FileMetadata(**snapshot_raw)
                        metadata_snapshot = parsed_metadata.model_dump()
                        metadata_snapshot['created_at'] = parsed_metadata.created_at.isoformat()
                    except Exception as exc:
                        metadata_snapshot = snapshot_raw
                        created_at = metadata_snapshot.get('created_at')
                        if isinstance(created_at, datetime):
                            metadata_snapshot['created_at'] = created_at.isoformat()
                        errors.append(f"Metadata parsing warning: {str(exc)}")

                delete_success = mongodb_adapter.delete_data(
                    filename,
                    collection_name='file_metadata'
                )
                if delete_success:
                    deleted_items.append(f"MongoDB: file_metadata/{filename}")
        except Exception as e:
            # MongoDB is optional, log error but don't fail
            errors.append(f"MongoDB deletion error: {str(e)}")
        
        if deleted_items:
            result = {
                "success": True,
                "message": "File deleted successfully",
                "filename": filename,
                "bucket": bucket,
                "deleted": deleted_items,
                "metadata": metadata_snapshot
            }
            if errors:
                result["warnings"] = errors
            return result

        raise HTTPException(
            status_code=404,
            detail={
                "message": "File not found or deletion failed",
                "filename": filename,
                "bucket": bucket,
                "errors": errors
            }
        )

    def remove_file(self, filename: str, bucket: str, current_user_id: str) -> Dict[str, Any]:
        """Check ownership and then remove objects and metadata."""
        metadata = self.get_metadata(filename)

        if not metadata:
            # If there is no metadata, we cannot verify ownership.
            # We also can't know if there's a corresponding file in MinIO without listing,
            # but we can try to delete and see. A safer default is to deny.
            # However, the original logic implies we might have orphan files.
            # The most robust action is to check MinIO directly.
            if not self.storage_manager.exists("minio", filename, bucket=bucket):
                 raise FileNotFoundError(f"File '{filename}' not found.")
            # If it exists but has no metadata, it's an orphan. Only an admin should delete it.
            # For now, we deny deletion for non-admin users.
            raise PermissionError("Cannot delete file without metadata to verify ownership.")

        is_uploader = metadata.get("uploader_id") == current_user_id
        is_trip_owner = False
        
        trip_id = metadata.get("trip_id")
        if trip_id:
            try:
                trip = self.trip_service.get_trip(trip_id)
                if trip and trip.owner_id == current_user_id:
                    is_trip_owner = True
            except Exception as e:
                self.logger.warning("Error checking trip ownership for deletion: %s", e)

        if not is_uploader and not is_trip_owner:
            raise PermissionError("Not authorized to delete this file.")

        return self._delete_file(filename, bucket)

    @classmethod
    def delete_file(cls, filename: str, bucket: str = "images") -> Dict[str, Any]:
        """Backward-compatible wrapper. This can't be used for authorized requests."""
        # This method is now problematic as it doesn't have user context.
        # It's better to use an instance with dependencies injected.
        # For now, we will assume it's for internal system use if called.
        return cls().remove_file(filename, bucket, current_user_id="<system>")
