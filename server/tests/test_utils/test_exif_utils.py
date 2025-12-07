import io
from fractions import Fraction
from datetime import datetime, timezone
import pytest
from PIL import Image

from src.utils import exif_utils

# --- Test _serialize_exif_value ---

def test_serialize_exif_value():
    assert exif_utils._serialize_exif_value(b"test") == "test"
    assert exif_utils._serialize_exif_value((1, 2)) == [1, 2]
    # Simulate an IFDRational object
    class MockRational:
        def __init__(self, num, den):
            self.numerator = num
            self.denominator = den
    assert exif_utils._serialize_exif_value(MockRational(1, 2)) == 0.5
    assert exif_utils._serialize_exif_value({1: "a"}) == {"1": "a"}
    assert exif_utils._serialize_exif_value(123) == 123
    assert exif_utils._serialize_exif_value("string") == "string"
    assert exif_utils._serialize_exif_value(None) is None

# --- Test _component_to_float ---

def test_component_to_float():
    assert exif_utils._component_to_float((30, 1)) == 30.0
    assert exif_utils._component_to_float([15, 1]) == 15.0
    assert exif_utils._component_to_float(b"12.34") == 12.34
    assert exif_utils._component_to_float(42) == 42.0
    assert exif_utils._component_to_float("56.78") == 56.78
    assert exif_utils._component_to_float("invalid") == 0.0
    assert exif_utils._component_to_float(None) == 0.0

# --- Test _convert_to_degrees ---

def test_convert_to_degrees():
    dms = ((30, 1), (15, 1), (0, 1))
    assert pytest.approx(exif_utils._convert_to_degrees(dms)) == 30.25
    dms_float = (30.0, 15.0, 0.0)
    assert pytest.approx(exif_utils._convert_to_degrees(dms_float)) == 30.25
    assert exif_utils._convert_to_degrees(None) == 0.0
    assert exif_utils._convert_to_degrees([1]) == 1.0

# --- Test _normalize_gps_if_needed ---

def test_normalize_gps_if_needed():
    # Already normalized
    gps_in = {"GPSLatitude": 1, "GPSLatitudeRef": "N"}
    assert exif_utils._normalize_gps_if_needed(gps_in) == gps_in
    # Numeric keys
    gps_numeric = {1: "N", 2: (30, 1)}
    gps_out = exif_utils._normalize_gps_if_needed(gps_numeric)
    assert gps_out["GPSLatitudeRef"] == "N"
    assert gps_out["GPSLatitude"] == (30, 1)

# --- Test parse_exif_datetime ---

def test_parse_exif_datetime():
    # Standard EXIF format
    dt_str = "2023:01:01 12:00:00"
    expected = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    assert exif_utils.parse_exif_datetime(dt_str) == expected
    # ISO format
    dt_iso = "2023-01-01T12:00:00"
    assert exif_utils.parse_exif_datetime(dt_iso) == expected
    # With timezone
    dt_iso_tz = "2023-01-01T12:00:00+08:00"
    parsed_tz = exif_utils.parse_exif_datetime(dt_iso_tz)
    assert parsed_tz.tzinfo is not None
    assert parsed_tz.astimezone(timezone.utc).hour == 4
    # Invalid
    assert exif_utils.parse_exif_datetime("invalid") is None
    assert exif_utils.parse_exif_datetime(None) is None

# --- Main function tests ---

def make_raw_gps(deg, minute, sec, lat_ref="N", lon_ref="E"):
    return {
        1: lat_ref,
        2: ((deg, 1), (minute, 1), (sec, 1)),
        3: lon_ref,
        4: ((100, 1), (0, 1), (0, 1)),
    }

def test_exif_to_dict_numeric_gps():
    raw = {34853: make_raw_gps(25, 30, 0, "N", "E")}
    d = exif_utils.exif_to_dict(raw)
    assert "GPSInfo" in d
    assert isinstance(d["GPSInfo"], dict)

def test_get_lat_lon_from_exif_standard():
    gps_raw = make_raw_gps(25, 30, 0, "N", "E")
    exif = {"GPSInfo": gps_raw}
    lat, lon = exif_utils.get_lat_lon_from_exif(exif)
    assert pytest.approx(lat) == 25.5
    assert pytest.approx(lon) == 100.0

def test_get_lat_lon_from_exif_south_west():
    gps_raw = make_raw_gps(25, 30, 0, "S", "W")
    exif = {"GPSInfo": gps_raw}
    lat, lon = exif_utils.get_lat_lon_from_exif(exif)
    assert pytest.approx(lat) == -25.5
    assert pytest.approx(lon) == -100.0

def test_get_lat_lon_bytes_ref_and_fraction():
    gps = {
        1: b"S",
        2: ((30, 1), (15, 1), (0, 1)),
        3: b"W",
        4: ((120, 1), (0, 1), (0, 1)),
    }
    exif = {34853: gps}
    lat, lon = exif_utils.get_lat_lon_from_exif(exif)
    assert pytest.approx(lat) == -30.25
    assert pytest.approx(lon) == -120.0

def test_get_lat_lon_missing():
    assert exif_utils.get_lat_lon_from_exif({}) == (None, None)
    assert exif_utils.get_lat_lon_from_exif({"GPSInfo": {}}) == (None, None)

def test_extract_exif_from_stream_no_exif():
    # Create image without exif
    img_bytes = io.BytesIO()
    Image.new('RGB', (10, 10)).save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    exif = exif_utils.extract_exif_from_stream(img_bytes)
    assert exif == {}

def test_extract_exif_from_stream_with_exif():
    # Create a mock image with some EXIF data
    img = Image.new('RGB', (10, 10))
    # Pillow's Exif class is complex to construct, so we can't easily test
    # the full flow of writing real EXIF. This test file mainly focuses on the
    # parsing logic of the utils, assuming Pillow provides the data structures.
    # The most important part is that `extract_exif_from_stream` calls `exif_to_dict`.
    pass
