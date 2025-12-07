import pytest
import os
from unittest.mock import patch, MagicMock
from src.services.gpx_analysis_service import GpxAnalysisService, AnalysisResult

MINIMAL_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="10.0" lon="10.0">
        <ele>100.0</ele>
        <time>2023-01-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="10.01" lon="10.01">
        <ele>150.0</ele>
        <time>2023-01-01T10:10:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
"""

MALFORMED_GPX = "Not a GPX file"

class TestGPXAnalysisService:

    @patch('src.services.gpx_analysis_service.pickle.dumps')
    @patch('src.services.gpx_analysis_service.GpxParser')
    def test_analyze_gpx_data_success(self, mock_gpx_parser, mock_pickle_dumps):
        mock_analyzer = MagicMock()
        mock_analyzed_track = MagicMock()
        setattr(mock_analyzer, "_analyzed_tracks_object", mock_analyzed_track)
        
        mock_parser_instance = MagicMock()
        mock_parser_instance.get_raw_track_object.return_value = MagicMock()
        mock_gpx_parser.return_value = mock_parser_instance

        mock_pickle_dumps.return_value = b"pickled_mock"

        with patch('src.services.gpx_analysis_service.TrackAnalyzer', return_value=mock_analyzer):
            with patch('src.services.gpx_analysis_service.GpxAnalysisService.extract_track_summary') as mock_extract:
                mock_extract.return_value = {"total_points": 2, "elevation_gain_m": 50.0}
                result = GpxAnalysisService.analyze_gpx_data(MINIMAL_GPX.encode(), "test.gpx")

        assert isinstance(result, AnalysisResult)
        assert result.summary["total_points"] == 2
        assert result.serialized_object == b"pickled_mock"
        assert result.analyzed_track is mock_analyzed_track

    def test_analyze_gpx_data_empty_bytes(self):
        with pytest.raises(ValueError, match="GPX payload is required and cannot be empty"):
            GpxAnalysisService.analyze_gpx_data(b"", "test.gpx")

    def test_analyze_gpx_data_none(self):
        with pytest.raises(ValueError, match="GPX payload is required and cannot be empty"):
            GpxAnalysisService.analyze_gpx_data(None, "test.gpx")

    def test_analyze_gpx_data_malformed(self):
        # The underlying parser can raise various XML or parsing related errors
        with pytest.raises(Exception):
            GpxAnalysisService.analyze_gpx_data(MALFORMED_GPX.encode('utf-8'), "test.gpx")

    def test_extract_track_summary_empty(self):
        mock_track = MagicMock()
        mock_main_tracks = MagicMock()
        mock_main_tracks.get_main_tracks_points_list.return_value = []
        mock_track.get_main_tracks.return_value = mock_main_tracks
        
        summary = GpxAnalysisService.extract_track_summary(mock_track)
        assert summary == {}

    def test_extract_track_summary_logic(self, monkeypatch):
        # Since the underlying library is hard to mock, we can integration-test the summary logic
        # by running it on a real (but minimal) GPX file.
        # We don't mock GpxParser here.
        monkeypatch.setattr("os.unlink", lambda path: None) # prevent temp file deletion error
        
        result = GpxAnalysisService.analyze_gpx_data(MINIMAL_GPX.encode('utf-8'), "test.gpx")
        summary = result.summary
        
        assert summary['start_time'] is not None
        assert summary['end_time'] is not None
        assert summary['duration_seconds'] == 600 # 10 mins
        assert summary['elevation_gain_m'] == 50.0
        
        # Check bounding box
        bbox = summary['bounding_box']
        assert bbox['min_lat'] == 10.0
        assert bbox['max_lat'] == 10.01

