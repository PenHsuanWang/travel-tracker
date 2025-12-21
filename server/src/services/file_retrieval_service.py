# src/services/file_retrieval_service.py

import hashlib
import logging
import mimetypes
import os
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - optional dependency
    def load_dotenv() -> None:
        """Fallback no-op when python-dotenv is unavailable."""
        return None

from src.models.file_metadata import FileMetadata, FileMetadataResponse
from src.models.user import User
from src.services.trip_service import TripService
from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager

load_dotenv()


class FileRetrievalService:
    """Service for listing and retrieving files and metadata from storage.

    This service provides utilities to list objects, merge metadata from
    MongoDB, retrieve raw bytes for files, and assemble payloads used by
    the API layer (including geotagged image summaries and GPX analysis
    fallbacks).
    """
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.storage_manager = StorageManager()
        self.trip_service = TripService()
        self.image_variants_enabled = os.getenv("IMAGE_VARIANTS_ENABLED", "true").lower() != "false"
        self.format_priority = ["avif", "webp", "jpeg", "jpg"]
        self.minio_ready = False
        self.minio_init_error: Optional[str] = None

        try:
            minio_adapter = AdapterFactory.create_minio_adapter()
            self.storage_manager.add_adapter('minio', minio_adapter)
            self.minio_ready = True
        except Exception as exc:  # pragma: no cover - defensive guard
            self.minio_init_error = str(exc)
            self.logger.error("MinIO adapter not initialized: %s", exc)

        try:
            mongodb_adapter = AdapterFactory.create_mongodb_adapter()
            self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.warning("MongoDB adapter not initialized: %s", exc)

    def build_file_url(self, object_key: str, bucket_name: str, variant: Optional[str] = None) -> str:
        suffix = f"&variant={variant}" if variant else ""
        return f"/api/files/{quote(object_key, safe='/')}?bucket={bucket_name}{suffix}"

    def _load_metadata(self, object_key: str) -> Optional[FileMetadata]:
        mongodb_adapter = self.storage_manager.adapters.get('mongodb')
        if not mongodb_adapter:
            return None
        raw = None
        try:
            raw = mongodb_adapter.load_data(object_key, collection_name='file_metadata')
        except Exception:
            raw = None
        if not raw:
            return None
        try:
            return FileMetadata(**raw)
        except Exception as exc:
            self.logger.debug("Failed to parse metadata for %s: %s", object_key, exc)
            return None

    def _pick_best_variant_key(
        self,
        variant_map: Dict[str, str],
        accept_header: Optional[str]
    ) -> Optional[str]:
        if not variant_map:
            return None

        accept = (accept_header or "").lower()
        ordered_candidates: List[str] = []
        if "image/avif" in accept:
            ordered_candidates.append("avif")
        if "image/webp" in accept:
            ordered_candidates.append("webp")
        if "image/jpeg" in accept or "image/jpg" in accept:
            ordered_candidates.append("jpeg")
        ordered_candidates.extend(self.format_priority)

        for fmt in ordered_candidates:
            key = variant_map.get(fmt) or variant_map.get(self._canonical_format(fmt))
            if key:
                return key

        # Fallback to first available
        return next(iter(variant_map.values()), None)

    @staticmethod
    def _canonical_format(fmt: str) -> str:
        return "jpeg" if fmt.lower() == "jpg" else fmt.lower()

    @staticmethod
    def _guess_media_type(filename: str, default: str = "application/octet-stream") -> str:
        media_type, _ = mimetypes.guess_type(filename)
        return media_type or default

    @staticmethod
    def _cache_control_for_variant(is_variant: bool) -> str:
        if is_variant:
            return "public, max-age=31536000, immutable"
        return "public, max-age=86400"

    @staticmethod
    def compute_etag(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    def list_files(self, bucket_name: str, trip_id: Optional[str] = None) -> List[str]:
        """List object keys in the given bucket.

        Args:
            bucket_name: Name of the MinIO bucket.
            trip_id: If provided, list keys under the trip prefix.

        Returns:
            Object keys in the bucket (possibly filtered by trip).
        """
        if not self.minio_ready:
            error = self.minio_init_error or "MinIO adapter not configured"
            raise RuntimeError(error)
        prefix = f"{trip_id}/" if trip_id else ""
        return self.storage_manager.list_keys('minio', prefix=prefix, bucket=bucket_name)

    def list_files_with_metadata(
        self, bucket_name: str, current_user: Optional[User], trip_id: Optional[str] = None
    ) -> List[FileMetadataResponse]:
        """Lists files with metadata, including a computed `can_delete` field.

        This method fetches file metadata and, based on the `current_user`,
        determines if they have permission to delete each file. For unauthenticated
        users (guests), all files will have `can_delete=False`.

        Args:
            bucket_name: The MinIO bucket to query.
            current_user: The authenticated user making the request (None for guests).
            trip_id: The optional trip ID to scope the results.

        Returns:
            A list of `FileMetadataResponse` objects, each with the `can_delete`
            flag correctly set.
        """
        if 'mongodb' not in self.storage_manager.adapters:
            raise RuntimeError("MongoDB adapter not configured")

        trip = None
        if trip_id:
            try:
                trip = self.trip_service.get_trip(trip_id)
            except Exception as e:
                self.logger.warning(f"Could not fetch trip {trip_id} while listing files: {e}")

        mongodb_adapter = self.storage_manager.adapters.get('mongodb')
        collection = mongodb_adapter.get_collection('file_metadata')
        query = {"bucket": bucket_name}
        if trip_id:
            query["trip_id"] = trip_id

        cursor = collection.find(query)
        items: List[FileMetadataResponse] = []

        for document in cursor:
            try:
                parsed_metadata = FileMetadata(**document)
                response_item = FileMetadataResponse(**parsed_metadata.model_dump())

                # For unauthenticated users, can_delete is always False
                if not current_user:
                    response_item.can_delete = False
                else:
                    is_owner = False
                    if trip and trip.owner_id:
                        is_owner = str(trip.owner_id) == str(current_user.id)

                    is_uploader = False
                    if parsed_metadata.uploader_id:
                        is_uploader = str(parsed_metadata.uploader_id) == str(current_user.id)

                    response_item.can_delete = is_owner or is_uploader

                # Add computed variant URLs (fall back to original when variants are disabled)
                response_item.thumb_url = self.build_file_url(
                    parsed_metadata.object_key,
                    parsed_metadata.bucket or bucket_name,
                    variant="thumb" if self.image_variants_enabled else None,
                )
                response_item.preview_url = self.build_file_url(
                    parsed_metadata.object_key,
                    parsed_metadata.bucket or bucket_name,
                    variant="preview" if self.image_variants_enabled else None,
                )
                    
                items.append(response_item)

            except Exception as exc:
                self.logger.warning(
                    "Skipping corrupt metadata document %s: %s",
                    document.get('_id'),
                    exc,
                    exc_info=True
                )
                continue

        items.sort(key=lambda item: item.created_at, reverse=True)
        return items

    def list_geotagged_images(
        self,
        bucket_name: str = "images",
        bbox: Optional[Dict[str, float]] = None,
        trip_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List images that contain GPS coordinates and return thumbnails.

        Args:
            bucket_name (str): Bucket name (default: "images").
            bbox (Optional[Dict[str, float]]): Bounding box filter with keys
                ``minLon``, ``minLat``, ``maxLon``, ``maxLat``.
            trip_id (Optional[str]): Trip id to scope results.

        Returns:
            List[Dict[str, Any]]: Geotagged image entries with coordinates and
            thumbnail URLs.
        """
        try:
            mongodb_adapter = self.storage_manager.adapters.get('mongodb')
            if not mongodb_adapter:
                self.logger.warning("MongoDB adapter not available for geo query")
                return []
            
            collection = mongodb_adapter.get_collection('file_metadata')
            
            # Build query for images with GPS
            query: Dict[str, Any] = {
                "gps": {"$exists": True, "$ne": None},
                "gps.latitude": {"$exists": True, "$ne": None},
                "gps.longitude": {"$exists": True, "$ne": None},
                "bucket": bucket_name
            }
            
            if trip_id:
                query["trip_id"] = trip_id
            
            # Apply bounding box filter if provided
            if bbox:
                min_lon = bbox.get('minLon')
                min_lat = bbox.get('minLat')
                max_lon = bbox.get('maxLon')
                max_lat = bbox.get('maxLat')
                
                if all(v is not None for v in [min_lon, min_lat, max_lon, max_lat]):
                    # MongoDB geospatial query for lat/lon within bbox
                    query["gps.latitude"] = {
                        "$gte": min_lat,
                        "$lte": max_lat
                    }
                    query["gps.longitude"] = {
                        "$gte": min_lon,
                        "$lte": max_lon
                    }
            
            cursor = collection.find(query)
            items: List[Dict[str, Any]] = []
            
            for document in cursor:
                try:
                    parsed = FileMetadata(**document)
                    
                    # Validate GPS coordinates
                    if not (parsed.gps and 
                            parsed.gps.latitude is not None and 
                            parsed.gps.longitude is not None):
                        continue
                    
                    # Generate thumbnail URL (use object_key for now)
                    # In production, this could use a thumbnail service or presigned URL
                    thumb_url = self._generate_thumbnail_url(parsed.object_key, parsed.bucket or bucket_name)
                    preview_url = self.build_file_url(
                        parsed.object_key,
                        parsed.bucket or bucket_name,
                        variant="preview" if self.image_variants_enabled else None,
                    )
                    
                    items.append({
                        'object_key': parsed.object_key,
                        'original_filename': parsed.filename or parsed.id,
                        'lat': float(parsed.gps.latitude),
                        'lon': float(parsed.gps.longitude),
                        'thumb_url': thumb_url,
                        'preview_url': preview_url,
                        'metadata_id': parsed.id,
                        'captured_at': parsed.captured_at.isoformat() if parsed.captured_at else None,
                        'captured_source': parsed.captured_source,
                        'note': parsed.note,
                        'note_title': parsed.note_title,
                        'order_index': parsed.order_index,
                    })
                except Exception as exc:
                    self.logger.warning(
                        "Error processing geotagged image %s: %s",
                        document.get('_id'),
                        exc
                    )
                    continue
            
            return items
        except Exception as exc:
            self.logger.error("Failed to retrieve geotagged images: %s", exc)
            return []

    def _generate_thumbnail_url(self, object_key: str, bucket_name: str) -> str:
        """Generate a thumbnail URL for an image.

        This currently returns a direct API path; in future it may return
        a presigned URL or a thumbnail service URL.

        Args:
            object_key (str): The object key in MinIO.
            bucket_name (str): The bucket name.

        Returns:
            str: URL string for the image/thumbnail.
        """
        try:
            from urllib.parse import quote
            
            variant = "thumb" if self.image_variants_enabled else None
            return self.build_file_url(object_key, bucket_name, variant=variant)
        except Exception as exc:
            self.logger.warning("Failed to generate thumbnail URL: %s", exc)
            return self.build_file_url(object_key, bucket_name)

    def get_file_bytes(self, bucket_name: str, filename: str) -> Optional[bytes]:
        """Retrieve raw bytes for a named object from MinIO.

        Args:
            bucket_name (str): MinIO bucket name.
            filename (str): Object key.

        Returns:
            Optional[bytes]: Raw bytes or ``None`` if not found.
        """
        if not self.minio_ready:
            self.logger.error("MinIO adapter not configured; cannot fetch %s from %s", filename, bucket_name)
            return None
        # Check if the file exists in the bucket.
        exists = self.storage_manager.exists('minio', filename, bucket=bucket_name)
        if not exists:
            return None

        # Load the file bytes from MinIO.
        file_bytes = self.storage_manager.load_data('minio', filename, bucket=bucket_name)
        return file_bytes

    def resolve_serving_key(
        self,
        filename: str,
        bucket_name: str,
        variant: str,
        accept_header: Optional[str] = None
    ) -> Tuple[str, str, bool]:
        """Pick the object key to serve based on variant request and Accept header.

        Returns (object_key, media_type, is_variant_served).
        """
        normalized_variant = (variant or "original").lower()
        if normalized_variant not in {"thumb", "preview", "original"}:
            normalized_variant = "original"

        # Only attempt variants for images bucket when feature flag is enabled
        if normalized_variant == "original" or bucket_name != "images" or not self.image_variants_enabled:
            media_type = self._guess_media_type(filename)
            return filename, media_type, False

        metadata = self._load_metadata(filename)
        variant_map: Dict[str, str] = {}
        if metadata:
            if normalized_variant == "thumb":
                variant_map = metadata.thumb_keys or {}
            elif normalized_variant == "preview":
                variant_map = metadata.preview_keys or {}

        selected_key = self._pick_best_variant_key(variant_map, accept_header)
        if not selected_key:
            # Fallback to original
            self.logger.debug("Variant %s requested for %s but not found. Falling back.", normalized_variant, filename)
            media_type = self._guess_media_type(filename, default="image/jpeg")
            return filename, media_type, False

        media_type = self._guess_media_type(selected_key, default="image/jpeg")
        return selected_key, media_type, True
