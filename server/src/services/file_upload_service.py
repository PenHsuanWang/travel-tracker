# src/services/file_upload_service.py

from fastapi import HTTPException, UploadFile  # type: ignore[import-not-found]
from src.services.data_io_handlers.handler_factory import HandlerFactory
from src.services.image_variant_service import ImageVariantService
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.models.file_metadata import HandlerResult, FileMetadata
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
import logging
from src.services.trip_service import TripService
from src.events.event_bus import EventBus


class FileUploadService:
    """Service for handling file uploads and persisting metadata.

    This service selects an appropriate data handler based on the uploaded
    file extension (via ``HandlerFactory``), coordinates storage of file
    bytes (MinIO) and metadata records (MongoDB), and triggers downstream
    processing such as GPX analysis and trip auto-fill when applicable.

    Only docstring/comments are modified in this module; no runtime logic
    is changed by these edits.
    """
    
    def __init__(self):
        self.storage_manager = StorageManager()
        # Initialize MongoDB adapter for metadata storage
        mongodb_adapter = AdapterFactory.create_mongodb_adapter()
        self.storage_manager.add_adapter('mongodb', mongodb_adapter)

        # Try to initialize MinIO adapter as well so operations like delete
        # can access the object storage. In some dev setups MinIO creds may
        # not be configured, so we catch and log the error instead of failing
        # service initialization.
        try:
            minio_adapter = AdapterFactory.create_minio_adapter()
            self.storage_manager.add_adapter('minio', minio_adapter)
        except Exception as e:
            logging.getLogger(__name__).warning(f"MinIO adapter not initialized: {e}")

        # Trip service is used for downstream updates (e.g., auto-filling trip dates from GPX)
        self.trip_service = TripService()
        self.image_variant_service = ImageVariantService(self.storage_manager)

    # --- GPX date helpers ---
    @staticmethod
    def _parse_iso_datetime(value: Optional[Any]) -> Optional[datetime]:
        """Parse an ISO-like timestamp into a :class:`datetime`.

        Accepts ISO-formatted strings (with optional ``Z`` timezone suffix)
        or actual :class:`datetime` objects. Returns ``None`` if the value
        cannot be parsed.

        Args:
            value (Optional[Any]): ISO timestamp string or ``datetime``.

        Returns:
            Optional[datetime]: Parsed :class:`datetime` in local representation
            or ``None`` when parsing fails.
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
        """Extract start/end datetimes from a GPX track summary.

        The ``track_summary`` is expected to be a mapping potentially containing
        ``start_time`` and ``end_time`` keys. This helper attempts to parse
        those fields into :class:`datetime` objects.

        Args:
            track_summary (Optional[Dict[str, Any]]): GPX track summary produced
                by the analysis pipeline.

        Returns:
            Tuple[Optional[datetime], Optional[datetime], bool]: ``(start, end, metadata_extracted)``
            where ``start`` and ``end`` are parsed datetimes (or ``None``), and
            ``metadata_extracted`` indicates whether any timestamp was found.
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
        """Attempt to auto-fill a trip's date range from GPX timestamps.

        When a GPX track provides start/end timestamps, this helper will
        compute activity start/end dates (floored to midnight) and attempt
        to update the trip document if its ``start_date`` or ``end_date``
        are not already set. The function returns a diagnostic payload that
        can be included in API responses.

        Args:
            trip_id (str): Trip identifier to update.
            track_summary (Optional[Dict[str, Any]]): GPX analysis summary.
            metadata_id (Optional[str]): Optional metadata id used for logging.

        Returns:
            Dict[str, Any]: Details about whether update was applied, reasons
            for failure, and any updated trip representation.
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
            logging.getLogger(__name__).warning(
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

    @staticmethod
    def _is_image_extension(file_extension: Optional[str]) -> bool:
        if not file_extension:
            return False
        return file_extension.lower() in {"jpg", "jpeg", "png", "gif", "webp", "avif"}
    
    @classmethod
    def save_file(
        cls,
        file: UploadFile,
        uploader_id: Optional[str] = None,
        trip_id: Optional[str] = None,
        plan_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Save an uploaded file and persist its metadata.

        The method selects a handler based on the file extension, stores the
        file contents via the handler (which typically writes to MinIO), and
        persists a ``file_metadata`` document in MongoDB. For GPX files,
        callers must supply either ``trip_id`` (trip-scoped GPX) or
        ``plan_id`` (plan-scoped reference track). Trip uploads enforce a
        single GPX per trip and may auto-fill trip dates; plan uploads skip
        trip-side effects and store data in the ``plan-assets`` bucket.

        Args:
            file (UploadFile): The uploaded file object received from FastAPI.
            uploader_id (Optional[str]): ID of the uploading user.
            trip_id (Optional[str]): Trip ID to associate with the upload.

        Returns:
            Dict[str, Any]: Payload describing saved metadata, analysis results,
            and any auto-filled trip information.

        Raises:
            ValueError: If a GPX file is uploaded without a ``trip_id`` or ``plan_id``.
        """
        service = cls()
        file_extension = file.filename.split('.')[-1].lower()
        handler = HandlerFactory.get_handler(file_extension)

        # Enforce scoping for GPX uploads (must target a trip or a plan)
        if file_extension == "gpx" and not (trip_id or plan_id):
            raise ValueError("trip_id or plan_id is required when uploading GPX tracks")

        if file_extension == "gpx" and trip_id and plan_id:
            raise ValueError("Provide only one of trip_id or plan_id for GPX uploads")
        
        # Enforce single GPX file per trip: delete existing GPX files before uploading new one
        if file_extension == "gpx" and trip_id:
            try:
                mongodb_adapter = service.storage_manager.adapters.get('mongodb')
                if mongodb_adapter:
                    collection = mongodb_adapter.get_collection('file_metadata')
                    # Find all GPX files for this trip
                    cursor = collection.find({"trip_id": trip_id, "file_extension": "gpx"})
                    for doc in cursor:
                        try:
                            # Use object_key (which is _id) and bucket to delete
                            cls.delete_file(doc['_id'], bucket=doc.get('bucket', 'gps-data'))
                            logging.getLogger(__name__).info(f"Deleted existing GPX file {doc['_id']} for trip {trip_id}")
                        except Exception as e:
                            logging.getLogger(__name__).warning(f"Failed to delete existing GPX {doc['_id']}: {e}")
            except Exception as e:
                logging.getLogger(__name__).warning(f"Error checking/deleting existing GPX files: {e}")
        
        if file_extension == "gpx":
            result = handler.handle(file, trip_id=trip_id, plan_id=plan_id)
        else:
            result = handler.handle(file, trip_id=trip_id)
        
        # Handle legacy handlers that return strings
        if isinstance(result, str):
            return {
                "file_path": result,
                "filename": file.filename,
                "status": "success"
            }
        
        # Handle new HandlerResult with metadata
        if isinstance(result, HandlerResult):
            variant_payload = {
                "status": "not_applicable",
                "thumb_keys": {},
                "preview_keys": {},
                "formats": [],
                "generated_at": None,
            }

            if cls._is_image_extension(result.file_extension):
                try:
                    variant_payload = service.image_variant_service.generate_variants(
                        result.object_key,
                        bucket=result.bucket,
                    )
                except Exception as exc:
                    logging.getLogger(__name__).warning(
                        "Image variant generation failed for %s: %s", result.object_key, exc
                    )

            # Save metadata to MongoDB
            metadata_id = result.object_key
            metadata = FileMetadata(
                id=metadata_id,
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
                plan_id=plan_id,
                has_gpx_analysis=result.has_gpx_analysis,
                analysis_object_key=result.analysis_object_key,
                analysis_bucket=result.analysis_bucket,
                analysis_status=result.analysis_status,
                analysis_error=result.analysis_error,
                track_summary=result.track_summary,
                status=result.status,
                thumb_keys=variant_payload.get("thumb_keys") or {},
                preview_keys=variant_payload.get("preview_keys") or {},
                formats=variant_payload.get("formats") or [],
                variants_status=variant_payload.get("status"),
                variants_generated_at=variant_payload.get("generated_at"),
            )
            
            # Save to MongoDB
            service.storage_manager.save_data(
                metadata_id,
                metadata.model_dump(by_alias=True),
                adapter_name='mongodb',
                collection_name='file_metadata'
            )
            
            response_payload: Dict[str, Any] = {
                "metadata_id": metadata_id,
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
                "plan_id": plan_id,
                "thumb_keys": variant_payload.get("thumb_keys") or {},
                "preview_keys": variant_payload.get("preview_keys") or {},
                "variants_status": variant_payload.get("status"),
                "formats": variant_payload.get("formats") or [],
                "variants_generated_at": variant_payload.get("generated_at").isoformat() if variant_payload.get("generated_at") else None,
            }

            if getattr(result, "file_extension", "") and result.file_extension.lower() == "gpx" and trip_id:
                auto_fill_details = service._maybe_autofill_trip_dates(trip_id, result.track_summary, metadata_id)
                response_payload["trip_dates_auto_filled"] = auto_fill_details.get("applied")
                response_payload["auto_fill_reason"] = auto_fill_details.get("reason")
                response_payload["gpx_metadata_extracted"] = auto_fill_details.get("metadata_extracted")
                response_payload["gpx_start_datetime"] = auto_fill_details.get("start_datetime")
                response_payload["gpx_end_datetime"] = auto_fill_details.get("end_datetime")
                response_payload["activity_start_datetime"] = auto_fill_details.get("activity_start_datetime")
                response_payload["activity_end_datetime"] = auto_fill_details.get("activity_end_datetime")
                if auto_fill_details.get("trip"):
                    response_payload["trip"] = auto_fill_details["trip"]

                # Publish GPX_PROCESSED event for gamification
                if result.track_summary:
                    try:
                        stats_payload = {
                            "distance_km": result.track_summary.get("total_distance_km") or (result.track_summary.get("total_distance_m") or 0) / 1000,
                            "elevation_gain_m": result.track_summary.get("elevation_gain_m", 0),
                            "moving_time_sec": result.track_summary.get("duration_seconds", 0),
                            "max_altitude_m": result.track_summary.get("max_elevation_m") or result.track_summary.get("max_altitude_m") or 0,
                        }
                        service.trip_service.update_trip_stats(trip_id, stats_payload)

                        trip = service.trip_service.get_trip(trip_id)
                        if trip:
                            stats = {
                                "distance_km": result.track_summary.get("total_distance_km", 0),
                                "elevation_gain_m": result.track_summary.get("elevation_gain_m", 0),
                            }
                            EventBus.publish("GPX_PROCESSED", {
                                "trip_id": trip_id,
                                "stats": stats,
                                "member_ids": trip.member_ids
                            })
                    except Exception as e:
                        logging.getLogger(__name__).error(f"Failed to publish GPX_PROCESSED event: {e}")

            return response_payload
        
        return {
            "filename": file.filename,
            "status": "unknown",
            "error": "Unexpected handler result type"
        }
    
    @classmethod
    def get_file_metadata(cls, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve persisted metadata for a file by its metadata id.

        Args:
            metadata_id (str): The metadata document id / object key.

        Returns:
            Optional[Dict[str, Any]]: The metadata document loaded from MongoDB,
            or ``None`` if it does not exist.
        """
        service = cls()
        metadata = service.storage_manager.load_data(
            'mongodb',
            metadata_id,
            collection_name='file_metadata'
        )
        return metadata
    
    @classmethod
    def delete_file(cls, filename: str, bucket: str = "images") -> Dict[str, Any]:
        """Delete an object from object storage and remove its metadata.

        The method attempts to delete the object from MinIO (if the MinIO
        adapter is available) and then remove the corresponding
        ``file_metadata`` document from MongoDB. It returns a summary of
        deleted items and any warnings encountered. If no deletion succeeded
        this method raises an HTTPException with status 404.

        Args:
            filename (str): Object key / metadata document id to delete.
            bucket (str): MinIO bucket name (default: ``"images"``).

        Returns:
            Dict[str, Any]: Summary with ``success``, ``deleted``, ``metadata``,
            and optional ``warnings``.

        Raises:
            HTTPException: When deletion fails for all backends (404).
        """
        service = cls()
        deleted_items = []
        errors = []
        metadata_snapshot: Optional[Dict[str, Any]] = None
        
        # Delete from MinIO
        try:
            minio_adapter = service.storage_manager.adapters.get('minio')
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
            mongodb_adapter = service.storage_manager.adapters.get('mongodb')
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
        else:
            raise HTTPException(
                status_code=404,
                detail={
                    "message": "File not found or deletion failed",
                    "filename": filename,
                    "bucket": bucket,
                    "errors": errors
                }
            )
