import io
from fractions import Fraction

import pytest

from src.utils.exif_utils import exif_to_dict, get_lat_lon_from_exif


def make_raw_gps(deg, minute, sec, lat_ref="N", lon_ref="E"):
    # GPS tags typically: 1:LatRef, 2:Lat, 3:LonRef, 4:Lon
    return {
        1: lat_ref,
        2: ((deg, 1), (minute, 1), (sec, 1)),
        3: lon_ref,
        4: ((100, 1), (0, 1), (0, 1)),
    }


def test_exif_to_dict_numeric_gps():
    raw = {34853: make_raw_gps(25, 30, 0, "N", "E")}
    d = exif_to_dict(raw)
    # 34853 should map to 'GPSInfo'
    assert "GPSInfo" in d


def test_get_lat_lon_from_exif_standard():
    # Create exif dict where GPSInfo is numeric mapping
    gps_raw = make_raw_gps(25, 30, 0, "N", "E")
    exif = {"GPSInfo": gps_raw}
    lat, lon = get_lat_lon_from_exif(exif)
    assert pytest.approx(lat, rel=1e-6) == 25.5
    # longitude in test uses 100 degrees from make_raw_gps
    assert pytest.approx(lon, rel=1e-6) == 100.0


def test_get_lat_lon_bytes_ref_and_fraction():
    # Create GPS components using Fraction and bytes refs
    gps = {
        1: b"S",
        2: ((30, 1), (15, 1), (0, 1)),
        3: b"W",
        4: ((120, 1), (0, 1), (0, 1)),
    }
    exif = {34853: gps}
    lat, lon = get_lat_lon_from_exif(exif)
    assert pytest.approx(lat, rel=1e-6) == -30.25
    assert pytest.approx(lon, rel=1e-6) == -120.0


def test_get_lat_lon_missing():
    assert get_lat_lon_from_exif({}) == (None, None)
