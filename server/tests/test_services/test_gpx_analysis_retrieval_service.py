import pytest
import pickle
from unittest.mock import MagicMock
from src.services.gpx_analysis_retrieval_service import GpxAnalysisRetrievalService
from src.services.gpx_analysis_service import AnalysisResult

class TestGpxAnalysisRetrievalService:

    @pytest.fixture
    def retrieval_service(self, mock_mongodb_adapter, mock_minio_adapter):
        service = GpxAnalysisRetrievalService()
        service.storage_manager.adapters['mongodb'] = mock_mongodb_adapter
        service.storage_manager.adapters['minio'] = mock_minio_adapter
        return service

    def test_get_analyzed_track_success(self, retrieval_service, mock_minio_adapter):
        # The service should be able to pickle any object.
        pickled_data = pickle.dumps({"track": "data"})
        
        mock_minio_adapter.save_data("trip1/track.gpx.analyzed.pkl", pickled_data, bucket="gps-analysis-data")
        
        result = retrieval_service.get_analyzed_track("trip1/track.gpx.analyzed.pkl")
        assert result is not None
        assert result["track"] == "data"

    def test_get_analyzed_track_missing(self, retrieval_service):
        result = retrieval_service.get_analyzed_track("missing")
        assert result is None

    def test_get_track_summary_from_metadata(self, retrieval_service, mock_mongodb_adapter):
        meta_id = "file1"
        doc = {
            "_id": meta_id,
            "object_key": "trip1/track.gpx",
            "track_summary": {"distance_km": 10.5}
        }
        mock_mongodb_adapter.save_data(meta_id, doc, collection_name='file_metadata')
        
        summary = retrieval_service.get_track_summary(meta_id)
        assert summary['distance_km'] == 10.5

    def test_get_track_summary_missing_metadata(self, retrieval_service):
        summary = retrieval_service.get_track_summary("missing")
        assert summary is None

    def test_extract_coordinates(self, retrieval_service):
        # Mock the structure of AnalyzedTrackObject
        mock_point = MagicMock()
        mock_point.lat = 10.0
        mock_point.lon = 20.0
        
        mock_track = MagicMock()
        main_tracks_mock = MagicMock()
        main_tracks_mock.get_main_tracks_points_list.return_value = [mock_point]
        mock_track.get_main_tracks.return_value = main_tracks_mock
        
        coords = retrieval_service.extract_coordinates(mock_track)
        assert len(coords) == 1
        assert coords[0] == [10.0, 20.0]

