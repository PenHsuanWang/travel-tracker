"""Service for managing GPX waypoint notes.

This module provides a service to update notes for individual waypoints
within a GPX file. The notes are stored in the `file_metadata`
document associated with the GPX file.
"""

from typing import Optional, Dict, Any
import logging

from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager


class GpxNoteService:
    """Service to manage waypoint notes stored in `file_metadata`."""

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

    def update_waypoint_note(
        self,
        gpx_object_key: str,
        waypoint_index: int,
        note: Optional[str],
        note_title: Optional[str]
    ) -> Dict[str, Any]:
        """
        Update the note for a specific waypoint within a GPX file's metadata.

        :param gpx_object_key: The object key of the GPX file.
        :param waypoint_index: The index of the waypoint to update.
        :param note: The note text to save.
        :param note_title: The title for the note.
        :return: The updated metadata document for the GPX file.
        :raises ValueError: If the GPX file metadata is not found.
        """
        collection = self._get_collection()

        # The key for the waypoint note in the metadata document
        note_key = f"metadata.waypoint_notes.{waypoint_index}"

        # The update payload for the waypoint note
        note_payload = {
            "note": note,
            "note_title": note_title,
        }

        # Use $set to update the specific waypoint note in the nested dictionary
        result = collection.update_one(
            {"object_key": gpx_object_key},
            {"$set": {note_key: note_payload}}
        )

        if result.matched_count == 0:
            raise ValueError(f"GPX metadata not found for object key: {gpx_object_key}")

        # Load and return the full, updated document
        updated_document = collection.find_one({"object_key": gpx_object_key})
        if not updated_document:
            # This should not happen if the update succeeded, but as a safeguard
            raise ValueError(f"GPX metadata not found for object key: {gpx_object_key} after update")

        return updated_document


gpx_note_service = GpxNoteService()
