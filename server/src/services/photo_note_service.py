"""Update helper for photo metadata notes and ordering."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from src.utils.dbbutler.storage_manager import StorageManager


class PhotoNoteService:
    """Manage note/order fields for photo metadata documents."""

    def __init__(self, storage_manager: StorageManager) -> None:
        self.logger = logging.getLogger(__name__)
        self.storage_manager = storage_manager

    def _get_collection(self):
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        return adapter.get_collection('file_metadata')

    def update_note(self, metadata_id: str, note: Optional[str], note_title: Optional[str]) -> Dict[str, Any]:
        """
        Update the note/note_title for a photo metadata entry.
        """
        collection = self._get_collection()
        update_doc: Dict[str, Any] = {"note": note}
        if note_title is not None:
            update_doc["note_title"] = note_title
        result = collection.update_one({"_id": metadata_id}, {"$set": update_doc})
        if result.matched_count == 0:
            raise ValueError("Photo metadata not found")

        return self._load_metadata(metadata_id)

    def update_order(self, metadata_id: str, order_index: int) -> Dict[str, Any]:
        """
        Update the order_index for a photo metadata entry.
        """
        collection = self._get_collection()
        result = collection.update_one({"_id": metadata_id}, {"$set": {"order_index": order_index}})
        if result.matched_count == 0:
            raise ValueError("Photo metadata not found")

        return self._load_metadata(metadata_id)

    def _load_metadata(self, metadata_id: str) -> Dict[str, Any]:
        """
        Load metadata and normalize datetime fields to isoformat for API responses.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        document = adapter.load_data(metadata_id, collection_name='file_metadata')
        if not document:
            raise ValueError("Photo metadata not found")

        try:
            from src.models.file_metadata import FileMetadata
            parsed = FileMetadata(**document)
            payload = parsed.model_dump()
            if parsed.created_at:
                payload["created_at"] = parsed.created_at.isoformat()
            if parsed.captured_at:
                payload["captured_at"] = parsed.captured_at.isoformat()
            return payload
        except Exception as exc:
            self.logger.warning("Failed to parse metadata %s: %s", metadata_id, exc)
            return document
