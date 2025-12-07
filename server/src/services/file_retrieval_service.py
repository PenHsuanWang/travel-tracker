# src/services/file_retrieval_service.py

import logging
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - optional dependency
    def load_dotenv() -> None:
        """Fallback no-op when python-dotenv is unavailable."""
        return None

from src.models.file_metadata import FileMetadata
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

        try:
            minio_adapter = AdapterFactory.create_minio_adapter()
            self.storage_manager.add_adapter('minio', minio_adapter)
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.warning("MinIO adapter not initialized: %s", exc)

        try:
            mongodb_adapter = AdapterFactory.create_mongodb_adapter()
            self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.warning("MongoDB adapter not initialized: %s", exc)

    def list_files(self, bucket_name: str, trip_id: Optional[str] = None) -> List[str]:
        """List object keys in the given bucket.

        Args:
            bucket_name (str): Name of the MinIO bucket.
            trip_id (Optional[str]): If provided, list keys under the trip prefix.

        Returns:
            List[str]: Object keys in the bucket (possibly filtered by trip).
        """
        if 'minio' not in self.storage_manager.adapters:
            raise RuntimeError("MinIO adapter not configured")
        prefix = f"{trip_id}/" if trip_id else ""
        return self.storage_manager.list_keys('minio', prefix=prefix, bucket=bucket_name)

    def list_files_with_metadata(self, bucket_name: str, trip_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List files and merge in metadata when available.

        When ``trip_id`` is provided, only files explicitly associated with
        that trip are returned. Objects from other trips (or orphan objects
        with no metadata) are intentionally hidden to prevent cross-trip leakage.

        Args:
            bucket_name (str): MinIO bucket name.
            trip_id (Optional[str]): Optional trip id to scope results.

        Returns:
            List[Dict[str, Any]]: Entries describing object_key, metadata_id,
            and included metadata where available.
        """
        if 'minio' not in self.storage_manager.adapters:
            raise RuntimeError("MinIO adapter not configured")

        prefix = f"{trip_id}/" if trip_id else ""
        object_keys = set(self.storage_manager.list_keys('minio', prefix=prefix, bucket=bucket_name))
        metadata_map: Dict[str, Dict[str, Any]] = {}

        mongodb_adapter = self.storage_manager.adapters.get('mongodb')
        if mongodb_adapter:
            try:
                collection = mongodb_adapter.get_collection('file_metadata')
                query = {"bucket": bucket_name}
                if trip_id:
                    query["trip_id"] = trip_id
                cursor = collection.find(query)
                for document in cursor:
                    try:
                        parsed = FileMetadata(**document)
                    except Exception as exc:  # pragma: no cover - data hygiene guard
                        self.logger.warning("Skipping corrupt metadata document %s: %s", document.get('_id'), exc)
                        continue

                    metadata_payload = parsed.model_dump()
                    metadata_payload['created_at'] = parsed.created_at.isoformat()
                    if parsed.captured_at:
                        metadata_payload['captured_at'] = parsed.captured_at.isoformat()
                    metadata_map[parsed.id] = metadata_payload
            except Exception as exc:  # pragma: no cover - resilience guard
                self.logger.warning("Failed to load metadata for bucket %s: %s", bucket_name, exc)

        items: List[Dict[str, Any]] = []

        for metadata_id, metadata in metadata_map.items():
            object_key = metadata.get('object_key') or metadata_id
            has_object = object_key in object_keys
            if has_object:
                object_keys.remove(object_key)

            items.append(
                {
                    'object_key': object_key,
                    'metadata_id': metadata_id,
                    'bucket': metadata.get('bucket', bucket_name),
                    'has_storage_object': has_object,
                    'has_metadata': True,
                    'metadata': metadata,
                    'warnings': [] if has_object else ['storage_missing'],
                }
            )

        for orphan_key in sorted(object_keys):
            items.append(
                {
                    'object_key': orphan_key,
                    'metadata_id': orphan_key,
                    'bucket': bucket_name,
                    'has_storage_object': True,
                    'has_metadata': False,
                    'metadata': None,
                    'warnings': ['metadata_missing'],
                }
            )

        items.sort(
            key=lambda entry: (
                entry['metadata'].get('created_at') if entry['metadata'] else '',
                entry['object_key']
            ),
            reverse=True,
        )

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
                    
                    items.append({
                        'object_key': parsed.object_key,
                        'original_filename': parsed.filename or parsed.id,
                        'lat': float(parsed.gps.latitude),
                        'lon': float(parsed.gps.longitude),
                        'thumb_url': thumb_url,
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
            
            minio_adapter = self.storage_manager.adapters.get('minio')
            if not minio_adapter:
                return f"/api/files/{quote(object_key, safe='/')}?bucket={bucket_name}"
            
            # Try to generate presigned URL for thumbnail
            # For MVP, just return the direct image URL with proper URL encoding
            # TODO: Implement actual thumbnail generation or use presigned URLs
            return f"/api/files/{quote(object_key, safe='/')}?bucket={bucket_name}"
        except Exception as exc:
            self.logger.warning("Failed to generate thumbnail URL: %s", exc)
            from urllib.parse import quote
            return f"/api/files/{quote(object_key, safe='/')}?bucket={bucket_name}"

    def get_file_bytes(self, bucket_name: str, filename: str) -> Optional[bytes]:
        """Retrieve raw bytes for a named object from MinIO.

        Args:
            bucket_name (str): MinIO bucket name.
            filename (str): Object key.

        Returns:
            Optional[bytes]: Raw bytes or ``None`` if not found.
        """
        # Check if the file exists in the bucket.
        exists = self.storage_manager.exists('minio', filename, bucket=bucket_name)
        if not exists:
            return None

        # Load the file bytes from MinIO.
        file_bytes = self.storage_manager.load_data('minio', filename, bucket=bucket_name)
        return file_bytes
