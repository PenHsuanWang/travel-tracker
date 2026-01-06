from typing import Any, Dict, Optional, Tuple, IO
from datetime import datetime, timezone
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
    
    Special handling for GPSInfo: if raw_exif is an Exif object with get_ifd(),
    we dereference the GPS IFD to get the actual GPS data instead of the offset pointer.
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
        
        # Special handling for GPSInfo: dereference the GPS IFD if possible
        if name == "GPSInfo" and hasattr(raw_exif, "get_ifd"):
            try:
                gps_ifd = raw_exif.get_ifd(ExifTags.IFD.GPSInfo)
                if gps_ifd:
                    # Build a proper dict with GPS tag names
                    result["GPSInfo"] = {
                        ExifTags.GPSTAGS.get(k, str(k)): _serialize_exif_value(v)
                        for k, v in dict(gps_ifd).items()
                    }
                    continue
            except Exception:
                # If GPS IFD dereference fails, fall through to generic serializer
                pass
        
        # Serialize the value to JSON-compatible type
        result[name] = _serialize_exif_value(val)

    return result


def _component_to_float(comp: Any) -> Optional[float]:
    """Convert an EXIF GPS component to float.

    Returns ``None`` when the component is missing or cannot be parsed. This prevents
    silent fallback to ``0.0`` which can incorrectly appear as a valid coordinate.
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
                return None

        # int/float
        return float(comp)
    except Exception:
        return None


def _convert_to_degrees(value: Any) -> Optional[float]:
    """Convert GPS coordinates stored as D/M/S triplet to decimal degrees.

    Accepts an iterable of three components where each component may be a
    rational tuple, Fraction, or numeric. Returns decimal degrees as float.
    On malformed or missing input returns ``None`` so callers can treat the
    coordinate as absent instead of defaulting to 0.0 (Null Island).
    """
    try:
        if not value:
            return None
        # Ensure indexable
        deg = _component_to_float(value[0])
        minute = _component_to_float(value[1]) if len(value) > 1 else 0.0
        sec = _component_to_float(value[2]) if len(value) > 2 else 0.0

        if deg is None:
            return None

        # If minute/sec are None, treat them as 0 but keep the distinction that
        # the degree must be present to consider the coordinate valid.
        minute = minute or 0.0
        sec = sec or 0.0

        return deg + (minute / 60.0) + (sec / 3600.0)
    except Exception:
        return None


def _normalize_gps_if_needed(gps_raw: Any) -> Optional[Dict[str, Any]]:
    """Normalize GPSInfo mapping to a dict with named GPS tags.

    gps_raw may be a mapping with numeric keys (typical raw exif) or already
    a dict keyed by names. Returns a dict keyed by GPS tag names (e.g.
    'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef').
    
    Handles both numeric keys and stringified numeric keys (e.g., "2", "4").
    """
    if not gps_raw:
        return None

    gps: Dict[str, Any] = {}

    # If mapping-like with items(), iterate and map numeric keys to names
    try:
        for key, val in getattr(gps_raw, "items", lambda: [])():
            # Handle stringified numeric keys (convert "2" -> 2 for lookup)
            if isinstance(key, str) and key.isdigit():
                k_for_map = int(key)
            else:
                k_for_map = key
            
            name = ExifTags.GPSTAGS.get(k_for_map, str(key))
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

        if lat is None or lon is None:
            return None, None

        # Normalize refs
        if isinstance(lat_ref, (bytes, bytearray)):
            lat_ref = lat_ref.decode(errors="ignore")
        if isinstance(lon_ref, (bytes, bytearray)):
            lon_ref = lon_ref.decode(errors="ignore")

        if lat_ref and str(lat_ref).upper() in ("S", "SOUTH"):
            lat = -abs(lat)
        if lon_ref and str(lon_ref).upper() in ("W", "WEST"):
            lon = -abs(lon)

        # Treat explicit 0/0 as missing unless clearly intended by source.
        if lat == 0 and lon == 0:
            return None, None

        return float(lat), float(lon)
    except Exception:
        return None, None


def extract_exif_from_stream(stream: IO) -> Dict[str, Any]:
    """Read EXIF from a seekable stream and return normalized exif dict.

    The stream must be seekable (e.g. SpooledTemporaryFile or BytesIO).
    If Pillow cannot parse EXIF, returns an empty dict.
    
    Special handling: If the EXIF contains GPS data, we dereference the GPS IFD
    to ensure we get the actual GPS data dictionary instead of an offset pointer.
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
        
        # Additional GPS IFD dereference: if we have an Exif object and GPSInfo
        # wasn't properly dereferenced in exif_to_dict, try again here
        if hasattr(raw_exif, "get_ifd"):
            try:
                # Check if GPSInfo is still a pointer (int) instead of a dict
                if "GPSInfo" in exif and isinstance(exif["GPSInfo"], (int, str)):
                    gps_ifd = raw_exif.get_ifd(ExifTags.IFD.GPSInfo)
                    if gps_ifd:
                        exif["GPSInfo"] = {
                            ExifTags.GPSTAGS.get(k, str(k)): _serialize_exif_value(v)
                            for k, v in dict(gps_ifd).items()
                        }
            except Exception:
                # Best-effort: keep exif even if GPS deref fails
                pass
        
        return exif
    except Exception:
        return {}


def parse_exif_datetime(value: Any, assume_tz: timezone = timezone.utc) -> Optional[datetime]:
    """Parse common EXIF datetime strings into an aware datetime.

    Supports formats like 'YYYY:MM:DD HH:MM:SS' (typical EXIF) and ISO-8601.
    Returns None when parsing fails.
    """
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    # Typical EXIF format: 2024:01:02 12:34:56
    try:
        if text.count(":") >= 2 and " " in text:
            date_part, _, time_part = text.partition(" ")
            normalized_date = date_part.replace(":", "-")
            candidate = f"{normalized_date} {time_part}"
            dt = datetime.strptime(candidate, "%Y-%m-%d %H:%M:%S")
            return dt.replace(tzinfo=assume_tz)
    except Exception:
        pass

    # Try ISO-8601 parsing as fallback
    try:
        parsed = datetime.fromisoformat(text)
        # If naive, attach assumed timezone
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=assume_tz)
        return parsed
    except Exception:
        return None
