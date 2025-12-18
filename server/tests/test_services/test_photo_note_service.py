import pytest
from src.services.photo_note_service import PhotoNoteService
from src.models.file_metadata import FileMetadata
from datetime import datetime, timezone

# A more complete document that passes Pydantic validation inside the service
def create_metadata_doc(meta_id: str):
    return {
        "_id": meta_id,
        "object_key": f"trip1/{meta_id}.jpg",
        "bucket": "images",
        "filename": f"{meta_id}.jpg",
        "original_filename": f"orig_{meta_id}.jpg",
        "size": 12345,
        "mime_type": "image/jpeg",
        "file_extension": "jpg",
        "created_at": datetime.now(timezone.utc)
    }

class TestPhotoNoteService:

    @pytest.fixture
    def note_service(self, mock_mongodb_adapter):
        service = PhotoNoteService()
        service.storage_manager.adapters['mongodb'] = mock_mongodb_adapter
        return service

    def test_update_note_success(self, note_service, mock_mongodb_adapter):
        meta_id = "photo1"
        doc = create_metadata_doc(meta_id)
        mock_mongodb_adapter.save_data(meta_id, doc, collection_name='file_metadata')
        
        result = note_service.update_note(meta_id, "My Note", "My Title")
        
        # The service returns a dictionary
        assert result['note'] == "My Note"
        assert result['note_title'] == "My Title"
        
        # Verify persistence
        saved = mock_mongodb_adapter.load_data(meta_id, collection_name='file_metadata')
        assert saved['note'] == "My Note"
        assert saved['note_title'] == "My Title"

    def test_update_note_missing_doc(self, note_service):
        with pytest.raises(ValueError) as exc:
            note_service.update_note("missing", "Note", "Title")
        assert "not found" in str(exc.value)

    def test_update_order_success(self, note_service, mock_mongodb_adapter):
        meta_id = "photo1"
        doc = create_metadata_doc(meta_id)
        mock_mongodb_adapter.save_data(meta_id, doc, collection_name='file_metadata')
        
        result = note_service.update_order(meta_id, 5)
        
        assert result['order_index'] == 5
        
        saved = mock_mongodb_adapter.load_data(meta_id, collection_name='file_metadata')
        assert saved['order_index'] == 5

    def test_update_order_missing_doc(self, note_service):
        with pytest.raises(ValueError):
            note_service.update_order("missing", 1)

    def test_update_waypoint_note_success(self, note_service, mock_mongodb_adapter):
        meta_id = "gpx_file_1"
        # A bit more realistic for a GPX file
        doc = {
            "_id": meta_id, "object_key": meta_id, "bucket": "gps-data",
            "filename": meta_id, "original_filename": "track.gpx", "size": 54321,
            "mime_type": "application/gpx+xml", "file_extension": "gpx",
            "created_at": datetime.now(timezone.utc)
        }
        mock_mongodb_adapter.save_data(meta_id, doc, collection_name='file_metadata')

        result = note_service.update_waypoint_note(meta_id, 0, "New waypoint note", "New waypoint title")

        assert 'waypoint_overrides' in result
        assert result['waypoint_overrides']['0']['note'] == "New waypoint note"
        assert result['waypoint_overrides']['0']['note_title'] == "New waypoint title"

        saved = mock_mongodb_adapter.load_data(meta_id, collection_name='file_metadata')
        assert saved['waypoint_overrides']['0']['note'] == "New waypoint note"

