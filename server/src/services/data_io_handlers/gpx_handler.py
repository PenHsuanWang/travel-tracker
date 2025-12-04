"""Handler that persists GPX uploads and kicks off analysis."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import UploadFile

from src.models.file_metadata import HandlerResult
from src.services.data_io_handlers.base_handler import BaseHandler
from src.services.gpx_analysis_service import GpxAnalysisService
from src.services.service_dependencies import ensure_storage_manager
from src.utils.dbbutler.storage_manager import StorageManager


class GPXHandler(BaseHandler):
    """Store GPX files and optionally persist serialized analysis results."""

    def __init__(self, storage_manager: StorageManager | None = None) -> None:
        self.storage_manager = ensure_storage_manager(storage_manager, include_minio=True)

    def handle(self, file: UploadFile, trip_id: Optional[str] = None) -> HandlerResult:
        """
        Handle the uploaded GPX file.

        :param file: The uploaded GPX file.
        :param trip_id: Optional ID of the trip this file belongs to.
        :return: HandlerResult containing file info.
        """
        logger = logging.getLogger(__name__)
        if not trip_id:
            raise ValueError("trip_id is required when uploading GPX data so tracks are scoped to a trip")
        file_data = file.file.read()
        file_name = file.filename
        file_extension = file_name.split('.')[-1].lower()
        bucket_name = 'gps-data'

        logger.info("Processing GPX upload for trip %s", trip_id)

        safe_name = (file_name or "track.gpx").replace("/", "_")
        object_key = f"{trip_id}/{safe_name}"

        # Save raw GPX file data to MinIO using the 'minio' adapter and the bucket 'gps-data'
        self.storage_manager.save_data(object_key, file_data, adapter_name='minio', bucket=bucket_name)

        # Analyze GPX data and persist analysis artifact separately.
        analysis_status = 'not_attempted'
        analysis_error: Optional[str] = None
        analysis_object_key: Optional[str] = None
        analysis_bucket: Optional[str] = None
        analysis_result = None

        try:
            analysis_result = GpxAnalysisService.analyze_gpx_data(file_data, file_name)
            analysis_bucket = 'gps-analysis-data'
            analysis_object_key = f"{object_key}.analyzed.pkl"

            self.storage_manager.save_data(
                analysis_object_key,
                analysis_result.serialized_object,
                adapter_name='minio',
                bucket=analysis_bucket
            )
            analysis_status = 'success'
        except Exception as exc:
            analysis_status = 'failed'
            analysis_error = str(exc)
            logger.error("GPX analysis failed for %s: %s", file_name, exc)
            analysis_object_key = None
            analysis_bucket = None

        # Return HandlerResult so FileUploadService can save metadata
        return HandlerResult(
            object_key=object_key,
            bucket=bucket_name,
            filename=object_key,
            original_filename=file_name,
            size=len(file_data),
            mime_type='application/gpx+xml',
            file_extension=file_extension,
            trip_id=trip_id,
            status='success',
            has_gpx_analysis=(analysis_status == 'success'),
            analysis_object_key=analysis_object_key,
            analysis_bucket=analysis_bucket,
            analysis_status=analysis_status,
            analysis_error=analysis_error,
            track_summary=analysis_result.summary if analysis_result else None
        )
