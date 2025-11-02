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

    def list_files_with_metadata(self, bucket_name: str) -> List[Dict[str, Any]]:
        """List files and merge in metadata when available."""
        if 'minio' not in self.storage_manager.adapters:
            raise RuntimeError("MinIO adapter not configured")
        object_keys = set(self.storage_manager.list_keys('minio', prefix="", bucket=bucket_name))
        metadata_map: Dict[str, Dict[str, Any]] = {}

        mongodb_adapter = self.storage_manager.adapters.get('mongodb')
        if mongodb_adapter:
            try:
                collection = mongodb_adapter.get_collection('file_metadata')
                cursor = collection.find({"bucket": bucket_name})
                for document in cursor:
                    try:
                        parsed = FileMetadata(**document)
                    except Exception as exc:  # pragma: no cover - data hygiene guard
                        self.logger.warning("Skipping corrupt metadata document %s: %s", document.get('_id'), exc)
                        continue

                    metadata_payload = parsed.model_dump()
                    metadata_payload['created_at'] = parsed.created_at.isoformat()
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
