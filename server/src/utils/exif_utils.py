from typing import Any, Dict, Optional, Tuple, IO
from PIL import Image, ExifTags


def _serialize_exif_value(val: Any) -> Any:
    """Convert EXIF value to JSON-serializable type.
    
    Handles IFDRational, bytes, tuples, and nested structures.
    """
    # Handle IFDRational objects (PIL.TiffImagePlugin.IFDRational)
    if hasattr(val, "numerator") and hasattr(val, "denominator"):
        try:
            return float(val.numerator) / float(val.denominator) if val.denominator != 0 else float(val.numerator)
        except Exception:
            return None
    
    # Handle bytes
    if isinstance(val, (bytes, bytearray)):
        try:
            return val.decode('utf-8', errors='ignore')
        except Exception:
            return str(val)
    
    # Handle tuples (convert to list for JSON)
    if isinstance(val, tuple):
        return [_serialize_exif_value(item) for item in val]
    
    # Handle lists
    if isinstance(val, list):
        return [_serialize_exif_value(item) for item in val]
    
    # Handle dicts (nested EXIF data like GPSInfo)
    if isinstance(val, dict):
        return {str(k): _serialize_exif_value(v) for k, v in val.items()}
    
    # Handle primitive types
    if isinstance(val, (int, float, str, bool, type(None))):
        return val
    
    # Fallback: convert to string
    try:
        return str(val)
    except Exception:
        return None


def exif_to_dict(raw_exif: Any) -> Dict[str, Any]:
    """Normalize raw EXIF (tag id -> value) into a name->value dict.

    Accepts Pillow's raw exif mapping (which may be an Exif object or dict
    keyed by numeric tag ids) and returns a dict keyed by human-readable tag
    names. All values are converted to JSON-serializable types.
    If raw_exif is falsy, returns an empty dict.
    """
    if not raw_exif:
        return {}

    try:
        # raw_exif can be a mapping-like object
        items = dict(raw_exif).items()
    except Exception:
        # Unexpected format
        return {}

    result: Dict[str, Any] = {}
    for tag_id, val in items:
        name = ExifTags.TAGS.get(tag_id, str(tag_id))
        # Serialize the value to JSON-compatible type
        result[name] = _serialize_exif_value(val)

    return result


def _component_to_float(comp: Any) -> float:
    """Convert an EXIF GPS component to float.

    comp can be a (num, den) tuple, a Fraction-like object (with numerator/denominator),
    an int/float, or bytes. Returns a float, or 0.0 on unexpected formats.
    """
    try:
        # tuple-like rational e.g. (num, den)
        if isinstance(comp, (tuple, list)) and len(comp) >= 2:
            num, den = comp[0], comp[1]
            num = float(num)
            den = float(den) if den is not None else 1.0
            return num / den if den != 0 else float(num)

        # Fraction-like (has numerator / denominator)
        if hasattr(comp, "numerator") and hasattr(comp, "denominator"):
            num = float(comp.numerator)
            den = float(comp.denominator) if comp.denominator is not None else 1.0
            return num / den if den != 0 else float(num)

        # bytes -> try decode then float
        if isinstance(comp, (bytes, bytearray)):
            try:
                return float(comp.decode(errors="ignore"))
            except Exception:
                return 0.0

        # int/float
        return float(comp)
    except Exception:
        return 0.0


def _convert_to_degrees(value: Any) -> float:
    """Convert GPS coordinates stored as D/M/S triplet to decimal degrees.

    Accepts an iterable of three components where each component may be a
    rational tuple, Fraction, or numeric. Returns decimal degrees as float.
    On malformed input returns 0.0.
    """
    try:
        if not value:
            return 0.0
        # Ensure indexable
        deg = _component_to_float(value[0])
        minute = _component_to_float(value[1]) if len(value) > 1 else 0.0
        sec = _component_to_float(value[2]) if len(value) > 2 else 0.0
        return deg + (minute / 60.0) + (sec / 3600.0)
    except Exception:
        return 0.0


def _normalize_gps_if_needed(gps_raw: Any) -> Optional[Dict[str, Any]]:
    """Normalize GPSInfo mapping to a dict with named GPS tags.

    gps_raw may be a mapping with numeric keys (typical raw exif) or already
    a dict keyed by names. Returns a dict keyed by GPS tag names (e.g.
    'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef').
    """
    if not gps_raw:
        return None

    gps: Dict[str, Any] = {}

    # If mapping-like with items(), iterate and map numeric keys to names
    try:
        for key, val in getattr(gps_raw, "items", lambda: [])():
            name = ExifTags.GPSTAGS.get(key, str(key))
            gps[name] = val
    except Exception:
        # If the above failed, try a simple dict copy
        if isinstance(gps_raw, dict):
            for k, v in gps_raw.items():
                gps[str(k)] = v

    return gps if gps else None


def get_lat_lon_from_exif(exif: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """Extract decimal (lat, lon) from an EXIF dict (name->value or raw).

    Returns (lat, lon) floats or (None, None) if not available.
    """
    if not exif:
        return None, None

    # Try common named key first
    gps_raw = exif.get("GPSInfo") or exif.get(34853) or exif.get(0x8825)
    if not gps_raw:
        return None, None

    gps = _normalize_gps_if_needed(gps_raw)
    if not gps:
        return None, None

    lat_tuple = gps.get("GPSLatitude")
    lat_ref = gps.get("GPSLatitudeRef")
    lon_tuple = gps.get("GPSLongitude")
    lon_ref = gps.get("GPSLongitudeRef")

    if lat_tuple is None or lon_tuple is None:
        return None, None

    try:
        lat = _convert_to_degrees(lat_tuple)
        lon = _convert_to_degrees(lon_tuple)

        # Normalize refs
        if isinstance(lat_ref, (bytes, bytearray)):
            lat_ref = lat_ref.decode(errors="ignore")
        if isinstance(lon_ref, (bytes, bytearray)):
            lon_ref = lon_ref.decode(errors="ignore")

        if lat_ref and str(lat_ref).upper() in ("S", "SOUTH"):
            lat = -abs(lat)
        if lon_ref and str(lon_ref).upper() in ("W", "WEST"):
            lon = -abs(lon)

        return float(lat), float(lon)
    except Exception:
        return None, None


def extract_exif_from_stream(stream: IO) -> Dict[str, Any]:
    """Read EXIF from a seekable stream and return normalized exif dict.

    The stream must be seekable (e.g. SpooledTemporaryFile or BytesIO).
    If Pillow cannot parse EXIF, returns an empty dict.
    """
    try:
        stream.seek(0)
    except Exception:
        # Not seekable
        return {}

    try:
        img = Image.open(stream)
        raw_exif = None
        try:
            # Pillow 7+ exposes getexif()
            raw_exif = img.getexif()
        except Exception:
            # fallback: some Pillow versions use _getexif()
            raw_exif = getattr(img, "_getexif", None) and img._getexif()

        exif = exif_to_dict(raw_exif)
        return exif
    except Exception:
        return {}
