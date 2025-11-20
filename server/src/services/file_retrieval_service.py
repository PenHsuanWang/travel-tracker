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
    """
    Service for listing and retrieving files from MinIO.
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

    def list_files(self, bucket_name: str) -> List[str]:
        """
        List object keys in the given bucket.
        """
        if 'minio' not in self.storage_manager.adapters:
            raise RuntimeError("MinIO adapter not configured")
        return self.storage_manager.list_keys('minio', prefix="", bucket=bucket_name)

    def list_files_with_metadata(self, bucket_name: str, trip_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List files and merge in metadata when available."""
        if 'minio' not in self.storage_manager.adapters:
            raise RuntimeError("MinIO adapter not configured")
        object_keys = set(self.storage_manager.list_keys('minio', prefix="", bucket=bucket_name))
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
        """
        List images with GPS coordinates (geotagged images).
        
        :param bucket_name: The bucket name (default: 'images')
        :param bbox: Bounding box filter {minLon, minLat, maxLon, maxLat} (optional)
        :return: List of geotagged image data with thumbnail URLs
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
                "gps.longitude": {"$exists": True, "$ne": None}
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
                    thumb_url = self._generate_thumbnail_url(parsed.object_key, bucket_name)
                    
                    items.append({
                        'object_key': parsed.object_key,
                        'original_filename': parsed.filename or parsed.id,
                        'lat': float(parsed.gps.latitude),
                        'lon': float(parsed.gps.longitude),
                        'thumb_url': thumb_url,
                        'metadata_id': parsed.id,
                        'captured_at': parsed.captured_at.isoformat() if parsed.captured_at else None,
                        'captured_source': parsed.captured_source,
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
        """
        Generate a thumbnail URL for an image.
        
        :param object_key: The object key in MinIO
        :param bucket_name: The bucket name
        :return: URL string (presigned URL or direct URL)
        """
        try:
            from urllib.parse import quote
            
            minio_adapter = self.storage_manager.adapters.get('minio')
            if not minio_adapter:
                return f"/api/files/{quote(object_key, safe='')}?bucket={bucket_name}"
            
            # Try to generate presigned URL for thumbnail
            # For MVP, just return the direct image URL with proper URL encoding
            # TODO: Implement actual thumbnail generation or use presigned URLs
            return f"/api/files/{quote(object_key, safe='')}?bucket={bucket_name}"
        except Exception as exc:
            self.logger.warning("Failed to generate thumbnail URL: %s", exc)
            from urllib.parse import quote
            return f"/api/files/{quote(object_key, safe='')}?bucket={bucket_name}"

    def get_file_bytes(self, bucket_name: str, filename: str) -> Optional[bytes]:
        """
        Retrieve the raw bytes of a file from MinIO.
        Returns None if file doesn't exist.
        """
        # Check if the file exists in the bucket.
        exists = self.storage_manager.exists('minio', filename, bucket=bucket_name)
        if not exists:
            return None

        # Load the file bytes from MinIO.
        file_bytes = self.storage_manager.load_data('minio', filename, bucket=bucket_name)
        return file_bytes
