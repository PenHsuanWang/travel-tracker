"""Service for managing photo notes and ordering metadata.

This module provides a thin service used by endpoints that edit photo
metadata (notes, titles, display order). It persists changes to the
`file_metadata` collection via the project's storage adapters.
"""

from typing import Optional, Dict, Any
import logging

from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager


class PhotoNoteService:
    """Lightweight service to manage photo notes and order indexes stored in `file_metadata`.

    Methods return the normalized metadata document suitable for API
    responses (datetime fields converted to ISO strings where applicable).
    """

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.storage_manager = StorageManager()
        try:
            mongodb_adapter = AdapterFactory.create_mongodb_adapter()
            self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        except Exception as exc:
            self.logger.warning("MongoDB adapter not initialized: %s", exc)

    def _get_collection(self):
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        return adapter.get_collection('file_metadata')
    def update_note(self, metadata_id: str, note: Optional[str], note_title: Optional[str]) -> Dict[str, Any]:
        """Update the note and/or title for a photo metadata entry.

        Only fields that are explicitly provided (not None) will be updated.
        This allows independent updates of note and note_title.

        Args:
            metadata_id (str): The metadata document id to update.
            note (Optional[str]): Free-form note text. Only updated if not None.
            note_title (Optional[str]): Optional short title for the note. Only updated if not None.

        Returns:
            Dict[str, Any]: The updated metadata document.
        """
        collection = self._get_collection()
        update_doc: Dict[str, Any] = {}
        if note is not None:
            update_doc["note"] = note
        if note_title is not None:
            update_doc["note_title"] = note_title

        if not update_doc:
            # Nothing to update, just return current state
            return self._load_metadata(metadata_id)

        result = collection.update_one({"_id": metadata_id}, {"$set": update_doc})
        if result.matched_count == 0:
            raise ValueError("Photo metadata not found")

        return self._load_metadata(metadata_id)

    def update_order(self, metadata_id: str, order_index: int) -> Dict[str, Any]:
        """Update the display order index for a photo metadata entry.

        Args:
            metadata_id (str): The metadata document id to update.
            order_index (int): Zero-based order index for display sorting.

        Returns:
            Dict[str, Any]: The updated metadata document.
        """
        collection = self._get_collection()
        result = collection.update_one({"_id": metadata_id}, {"$set": {"order_index": order_index}})
        if result.matched_count == 0:
            raise ValueError("Photo metadata not found")

        return self._load_metadata(metadata_id)

    def update_waypoint_note(self, metadata_id: str, waypoint_index: int, note: Optional[str], note_title: Optional[str]) -> Dict[str, Any]:
        """Update the note for a specific waypoint in a GPX file's metadata.

        Args:
            metadata_id (str): The metadata document id for the GPX file.
            waypoint_index (int): The 0-based index of the waypoint.
            note (Optional[str]): The new note text.
            note_title (Optional[str]): The new title text.

        Returns:
            Dict[str, Any]: The updated metadata document.
        """
        collection = self._get_collection()
        update_doc = {}
        if note is not None:
            update_doc[f"waypoint_overrides.{waypoint_index}.note"] = note
        if note_title is not None:
            update_doc[f"waypoint_overrides.{waypoint_index}.note_title"] = note_title

        if not update_doc:
            return self._load_metadata(metadata_id)

        self.logger.debug(
            "Updating waypoint_overrides for _id %s with doc: %s",
            metadata_id,
            update_doc
        )
        result = collection.update_one({"_id": metadata_id}, {"$set": update_doc})
        self.logger.info(
            "MongoDB update result for _id %s: matched=%s, modified=%s",
            metadata_id,
            result.matched_count,
            result.modified_count
        )
        if result.matched_count == 0:
            raise ValueError("GPX metadata not found")

        return self._load_metadata(metadata_id)

    def _load_metadata(self, metadata_id: str) -> Dict[str, Any]:
        """Load metadata and normalize datetime fields for API responses.

        Converts datetime-like fields such as `created_at` and `captured_at`
        to ISO 8601 strings for safe JSON serialization.

        Args:
            metadata_id (str): Identifier of the `file_metadata` document.

        Returns:
            Dict[str, Any]: Parsed and normalized metadata document.
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
