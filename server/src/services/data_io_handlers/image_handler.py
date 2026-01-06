# src/services/handlers/image_handler.py

import uuid
import tempfile
import logging
from datetime import datetime, timezone
from fastapi import UploadFile
from typing import Optional
from src.services.data_io_handlers.base_handler import BaseHandler
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.utils.exif_utils import extract_exif_from_stream, get_lat_lon_from_exif, parse_exif_datetime
from src.models.file_metadata import HandlerResult, GPSData


class ImageHandler(BaseHandler):
    """
    Handler for image file uploads with EXIF extraction.
    """

    def __init__(self):
        self.storage_manager = StorageManager()
        
        # Use AdapterFactory for consistent initialization
        minio_adapter = AdapterFactory.create_minio_adapter()
        self.storage_manager.add_adapter('minio', minio_adapter)

    def handle(self, file: UploadFile, trip_id: Optional[str] = None, plan_id: Optional[str] = None) -> HandlerResult:
        """
        Handle the uploaded image file and extract EXIF metadata.

        :param file: The uploaded image file.
        :param trip_id: Optional ID of the trip this file belongs to.
        :param plan_id: Optional ID of the plan this file belongs to (unused for images).
        :return: HandlerResult containing file info and EXIF data.
        """
        # If trip_id is missing, we assume it's a profile avatar or similar non-trip image
        # We will use a different bucket or prefix if needed, but for now we just relax the check.
        # Ideally, we should have a 'context' param, but for now we infer from trip_id presence.
        
        bucket_name = 'images'
        if not trip_id:
            # Use 'avatars' bucket or prefix for non-trip images? 
            # For simplicity, let's keep using 'images' but use a 'public' or 'avatars' prefix
            # However, the current architecture uses trip_id as prefix.
            # Let's use 'avatars' as the "trip_id" prefix for avatars.
            prefix = "avatars"
        else:
            prefix = trip_id

        original_filename = file.filename
        file_extension = original_filename.split('.')[-1].lower()
        upload_time = datetime.now(timezone.utc)
        logger = logging.getLogger(__name__)
        
        # Generate unique object key
        unique_id = str(uuid.uuid4())
        safe_original = (original_filename or "image").replace("/", "_")
        object_key = f"{prefix}/{unique_id}_{safe_original}"
        
        # Use SpooledTemporaryFile for memory-efficient handling
        with tempfile.SpooledTemporaryFile(max_size=10*1024*1024) as temp_file:
            # Copy upload stream to temp file
            file.file.seek(0)
            temp_file.write(file.file.read())
            temp_file.seek(0)
            
            # Extract EXIF data
            exif_data = extract_exif_from_stream(temp_file)
            lat, lon = get_lat_lon_from_exif(exif_data)
            
            # Extract additional metadata
            gps_data = None
            if lat is not None and lon is not None:
                gps_data = GPSData(
                    latitude=lat,
                    longitude=lon,
                    altitude=self._extract_altitude(exif_data),
                    latitude_ref=self._get_gps_ref(exif_data, 'GPSLatitudeRef'),
                    longitude_ref=self._get_gps_ref(exif_data, 'GPSLongitudeRef')
                )
            
            date_taken = self._extract_date_taken(exif_data)
            captured_at = parse_exif_datetime(date_taken, assume_tz=timezone.utc)
            captured_source = 'exif' if captured_at else 'fallback'
            if not captured_at:
                captured_at = upload_time
            camera_make = exif_data.get('Make')
            camera_model = exif_data.get('Model')
            
            # Get file size
            temp_file.seek(0, 2)  # Seek to end
            file_size = temp_file.tell()
            temp_file.seek(0)
            
            # Read file data for storage
            file_data = temp_file.read()
            
        # Save to MinIO
        self.storage_manager.save_data(
            object_key, 
            file_data, 
            adapter_name='minio', 
            bucket=bucket_name
        )
        
        # Return HandlerResult
        logger.info(
            "[ImageHandler] extracted capture time for %s: raw=%s parsed=%s source=%s",
            original_filename,
            date_taken,
            captured_at.isoformat() if captured_at else None,
            captured_source,
        )

        return HandlerResult(
            object_key=object_key,
            bucket=bucket_name,
            filename=object_key,
            original_filename=original_filename,
            size=file_size,
            mime_type=file.content_type or 'image/jpeg',
            file_extension=file_extension,
            exif=exif_data if exif_data else None,
            gps=gps_data,
            date_taken=date_taken,
            captured_at=captured_at,
            captured_source=captured_source,
            camera_make=camera_make,
            camera_model=camera_model,
            trip_id=trip_id,
            status='success'
        )
    
    def _extract_altitude(self, exif_data: dict) -> float:
        """Extract altitude from EXIF GPS data"""
        try:
            gps_info = exif_data.get('GPSInfo')
            if gps_info:
                # Try different ways GPS info might be stored
                if hasattr(gps_info, 'get'):
                    altitude = gps_info.get('GPSAltitude') or gps_info.get(6)
                    if altitude:
                        # Handle rational tuple
                        if isinstance(altitude, (tuple, list)) and len(altitude) >= 2:
                            return float(altitude[0]) / float(altitude[1])
                        return float(altitude)
        except Exception:
            pass
        return None
    
    def _get_gps_ref(self, exif_data: dict, ref_key: str) -> str:
        """Extract GPS reference (N/S/E/W) from EXIF"""
        try:
            gps_info = exif_data.get('GPSInfo')
            if gps_info and hasattr(gps_info, 'get'):
                ref = gps_info.get(ref_key)
                if ref:
                    if isinstance(ref, bytes):
                        return ref.decode('utf-8', errors='ignore')
                    return str(ref)
        except Exception:
            pass
        return None
    
    def _extract_date_taken(self, exif_data: dict) -> str:
        """Extract date/time the photo was taken"""
        try:
            # Try different date fields
            for key in ['DateTimeOriginal', 'DateTime', 'DateTimeDigitized']:
                date_str = exif_data.get(key)
                if date_str:
                    if isinstance(date_str, bytes):
                        return date_str.decode('utf-8', errors='ignore')
                    return str(date_str)
        except Exception:
            pass
        return None
