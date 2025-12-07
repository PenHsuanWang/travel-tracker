import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from src.services.file_upload_service import FileUploadService
from src.models.file_metadata import HandlerResult, GPSData
from src.models.trip import Trip
from fastapi import UploadFile
from io import BytesIO

def create_mock_upload_file(filename: str, content: bytes) -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(content))

class TestFileUploadService:

    @pytest.fixture
    def upload_service(self, mock_mongodb_adapter, mock_minio_adapter):
        service = FileUploadService()
        service.storage_manager.adapters['mongodb'] = mock_mongodb_adapter
        service.storage_manager.adapters['minio'] = mock_minio_adapter
        # also mock the trip service on it
        service.trip_service = MagicMock()
        return service

    def test_parse_iso_datetime(self):
        service = FileUploadService
        assert service._parse_iso_datetime(None) is None
        assert service._parse_iso_datetime("invalid") is None
        
        dt = datetime(2023, 1, 1, 12, 0, 0)
        assert service._parse_iso_datetime(dt) == dt
        
        iso_str = "2023-01-01T12:00:00"
        parsed = service._parse_iso_datetime(iso_str)
        assert parsed == dt.replace(tzinfo=None)
        
        iso_z = "2023-01-01T12:00:00Z"
        parsed_z = service._parse_iso_datetime(iso_z)
        assert parsed_z.tzinfo is not None

    def test_extract_gpx_bounds(self):
        service = FileUploadService
        assert service._extract_gpx_bounds(None) == (None, None, False)
        assert service._extract_gpx_bounds({}) == (None, None, False)
        
        summary = {"start_time": "2023-01-01T10:00:00", "end_time": "2023-01-01T12:00:00"}
        start, end, extracted = service._extract_gpx_bounds(summary)
        assert extracted is True
        assert start.year == 2023
        assert end.hour == 12

    def test_floor_to_date(self):
        service = FileUploadService
        dt = datetime(2023, 1, 1, 15, 30, 45)
        floored = service._floor_to_date(dt)
        assert floored == datetime(2023, 1, 1, 0, 0, 0)
        
        dt_aware = datetime(2023, 1, 1, 15, 30, 45, tzinfo=timezone(timedelta(hours=3)))
        floored_aware = service._floor_to_date(dt_aware)
        assert floored_aware == datetime(2023, 1, 1, 0, 0, 0)

    def test_maybe_autofill_trip_dates_no_trip(self, upload_service):
        upload_service.trip_service.get_trip.return_value = None
        
        summary = {"start_time": "2023-02-01T10:00:00", "end_time": "2023-02-01T12:00:00"}
        result = upload_service._maybe_autofill_trip_dates("trip1", summary)
        assert result['applied'] is False
        assert result['reason'] == 'trip_not_found'

    def test_maybe_autofill_trip_dates_existing_dates(self, upload_service):
        trip = Trip(name="Dated Trip", start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 2))
        upload_service.trip_service.get_trip.return_value = trip
        upload_service.trip_service.update_trip.return_value = trip

        summary = {"start_time": "2023-02-01T10:00:00", "end_time": "2023-02-01T12:00:00"}
        
        result = upload_service._maybe_autofill_trip_dates("trip1", summary)
        assert result['applied'] is False
        assert result['reason'] == "trip_dates_already_set"

    def test_maybe_autofill_trip_dates_success(self, upload_service):
        trip = Trip(name="Undated Trip", id="trip1")
        updated_trip = Trip(name="Undated Trip", id="trip1", start_date=datetime(2023, 2, 1), end_date=datetime(2023, 2, 1))

        upload_service.trip_service.get_trip.return_value = trip
        upload_service.trip_service.update_trip.return_value = updated_trip
        
        summary = {"start_time": "2023-02-01T10:00:00", "end_time": "2023-02-01T12:00:00"}
        
        result = upload_service._maybe_autofill_trip_dates("trip1", summary)
        assert result['applied'] is True
        assert result['start_datetime'] is not None
        
        upload_service.trip_service.update_trip.assert_called_once()
        call_args = upload_service.trip_service.update_trip.call_args
        assert call_args[0][0] == "trip1"
        assert "start_date" in call_args[0][1]

    @patch('src.services.file_upload_service.HandlerFactory')
    def test_save_file_gpx(self, mock_factory, upload_service, mock_mongodb_adapter, mock_event_bus):
        mock_handler = MagicMock()
        mock_handler.handle.return_value = HandlerResult(
            object_key="trip1/track.gpx", bucket="gps-data", filename="trip1/track.gpx",
            original_filename="track.gpx", size=1024, mime_type="application/gpx+xml",
            file_extension="gpx", trip_id="trip1", track_summary={"total_distance_km": 10}
        )
        mock_factory.get_handler.return_value = mock_handler
        
        mock_trip = Trip(name="Trip", id="trip1", member_ids=["user1"])
        upload_service.trip_service.get_trip.return_value = mock_trip
        
        file = create_mock_upload_file("track.gpx", b"<gpx></gpx>")
        
        result = upload_service.save_file(file, uploader_id="user1", trip_id="trip1")
        
        assert result['metadata_id'] == "trip1/track.gpx"
        assert len(mock_event_bus) > 0
        assert mock_event_bus[0][0] == "GPX_PROCESSED"
        assert mock_event_bus[0][1]['stats']['distance_km'] == 10

    def test_save_file_gpx_missing_trip_id(self, upload_service):
        file = create_mock_upload_file("track.gpx", b"")
        
        with pytest.raises(ValueError, match="trip_id is required"):
            FileUploadService.save_file(file, trip_id=None)

    @patch('src.services.file_upload_service.HandlerFactory')
    def test_save_file_image(self, mock_factory, upload_service, mock_mongodb_adapter):
        mock_handler = MagicMock()
        mock_handler.handle.return_value = HandlerResult(
            object_key="trip1/photo.jpg", bucket="images", filename="trip1/photo.jpg",
            original_filename="photo.jpg", size=2048, mime_type="image/jpeg",
            file_extension="jpg", gps=GPSData(latitude=10.0, longitude=20.0)
        )
        mock_factory.get_handler.return_value = mock_handler
        
        file = create_mock_upload_file("photo.jpg", b"")
        
        result = upload_service.save_file(file, trip_id="trip1")
        
        assert result['metadata_id'] == "trip1/photo.jpg"
        assert result['has_gps'] is True
        
        saved = mock_mongodb_adapter.load_data("trip1/photo.jpg", collection_name='file_metadata')
        assert saved is not None
        assert saved['original_filename'] == "photo.jpg"

