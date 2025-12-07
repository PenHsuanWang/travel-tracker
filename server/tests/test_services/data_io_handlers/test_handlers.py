import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from io import BytesIO
from fastapi import UploadFile

from src.services.data_io_handlers.handler_factory import HandlerFactory
from src.services.data_io_handlers.gpx_handler import GPXHandler
from src.services.data_io_handlers.image_handler import ImageHandler
from src.services.data_io_handlers.csv_handler import CSVHandler
from src.models.file_metadata import HandlerResult
from src.services.gpx_analysis_service import AnalysisResult


def create_mock_upload_file(filename: str, content: bytes) -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(content))

class TestHandlerFactory:
    def test_get_handler(self):
        # The factory keys are lowercase
        assert isinstance(HandlerFactory.get_handler("gpx"), GPXHandler)
        assert isinstance(HandlerFactory.get_handler("jpg"), ImageHandler)
        assert isinstance(HandlerFactory.get_handler("png"), ImageHandler)
        assert isinstance(HandlerFactory.get_handler("csv"), CSVHandler)
        
        with pytest.raises(ValueError):
            HandlerFactory.get_handler("unknown")

class TestGPXHandler:
    @pytest.fixture
    def handler(self, mock_minio_adapter):
        # This setup allows the test to run without needing a running MinIO instance
        h = GPXHandler()
        h.storage_manager.adapters['minio'] = mock_minio_adapter
        return h

    @patch('src.services.gpx_analysis_service.GpxAnalysisService.analyze_gpx_data')
    def test_handle_success(self, mock_analyze, handler, mock_minio_adapter):
        # Mock analysis result
        mock_analysis_result = AnalysisResult(
            analyzed_track=MagicMock(),
            serialized_object=b"pickled",
            summary={"dist": 10}
        )
        mock_analyze.return_value = mock_analysis_result
        
        mock_file = create_mock_upload_file("track.gpx", b"<gpx>...</gpx>")
        
        result = handler.handle(
            file=mock_file,
            trip_id="trip1"
        )
        
        assert isinstance(result, HandlerResult)
        assert result.status == "success"
        assert result.bucket == "gps-data"
        assert result.track_summary['dist'] == 10
        assert result.object_key == "trip1/track.gpx"
        
        # Verify MinIO saves
        assert mock_minio_adapter.load_data("trip1/track.gpx", bucket="gps-data") == b"<gpx>...</gpx>"
        assert mock_minio_adapter.load_data("trip1/track.gpx.analyzed.pkl", bucket="gps-analysis-data") == b"pickled"

    def test_handle_missing_trip_id(self, handler):
        mock_file = create_mock_upload_file("track.gpx", b"")
        with pytest.raises(ValueError, match="trip_id is required"):
            handler.handle(mock_file, trip_id=None)

class TestImageHandler:
    @pytest.fixture
    def handler(self, mock_minio_adapter):
        h = ImageHandler()
        h.storage_manager.adapters['minio'] = mock_minio_adapter
        return h

    @patch('src.utils.exif_utils.extract_exif_from_stream')
    @patch('src.utils.exif_utils.get_lat_lon_from_exif')
    @patch('src.utils.exif_utils.parse_exif_datetime')
    def test_handle_success(self, mock_parse_dt, mock_get_gps, mock_extract, handler, mock_minio_adapter):
        mock_extract.return_value = {"Make": "Canon"}
        mock_get_gps.return_value = (10.0, 20.0)
        mock_parse_dt.return_value = None
        
        mock_file = create_mock_upload_file("photo.jpg", b"image data")
        
        result = handler.handle(
            file=mock_file,
            trip_id="trip1"
        )
        
        assert isinstance(result, HandlerResult)
        assert result.status == "success"
        assert result.bucket == "images"
        assert result.gps is not None
        assert result.gps.latitude == 10.0
        assert result.gps.longitude == 20.0
        assert result.camera_make == "Canon"
        
        # Object key should be unique
        assert result.object_key.startswith("trip1/")
        assert result.object_key.endswith("_photo.jpg")
        
        assert mock_minio_adapter.load_data(result.object_key, bucket="images") == b"image data"

class TestCSVHandler:
    @pytest.fixture
    def handler(self, mock_minio_adapter):
        h = CSVHandler()
        h.storage_manager.adapters['minio'] = mock_minio_adapter
        return h

    def test_handle_success(self, handler, mock_minio_adapter):
        mock_file = create_mock_upload_file("data.csv", b"col1,col2\nval1,val2")
        
        result = handler.handle(mock_file)
        
        assert result == 'uploadedfiles/data.csv'
        assert mock_minio_adapter.load_data("data.csv", bucket="uploadedfiles") == b"col1,col2\nval1,val2"

