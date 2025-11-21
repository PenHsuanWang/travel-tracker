# src/routes/file_retrieval_routes.py

import logging
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Response, Query  # type: ignore[import-not-found]
from pydantic import BaseModel  # type: ignore[import-not-found]

from src.services.file_retrieval_service import FileRetrievalService
from src.services.gpx_analysis_retrieval_service import GpxAnalysisRetrievalService
from src.models.file_metadata import FileMetadata

router = APIRouter()

retrieval_service = FileRetrievalService()
analysis_retrieval_service = GpxAnalysisRetrievalService()

logger = logging.getLogger(__name__)


class FileListItem(BaseModel):
    object_key: str
    metadata_id: str
    bucket: str
    has_storage_object: bool
    has_metadata: bool
    metadata: Optional[Dict[str, Any]] = None
    warnings: List[str] = []

class GeotaggedImage(BaseModel):
    object_key: str
    original_filename: str
    lat: float
    lon: float
    thumb_url: str
    metadata_id: Optional[str] = None
    captured_at: Optional[str] = None
    captured_source: Optional[str] = None


class GpxAnalysisResponse(BaseModel):
    filename: str
    display_name: str
    analysis_status: Optional[str] = None
    source: str
    has_gpx_analysis: Optional[bool] = None
    track_summary: Optional[Dict[str, Any]] = None
    coordinates: List[List[float]]
    waypoints: List[Dict[str, Any]] = []
    rest_points: List[Dict[str, Any]] = []

@router.get("/list-files", response_model=List[str])
async def list_files(bucket: str = "gps-data"):
    """
    List object keys in the specified MinIO bucket.
    Defaults to 'gps-data'.
    """
    try:
        keys = retrieval_service.list_files(bucket)
        return keys
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list-files/detail", response_model=List[FileListItem])
async def list_files_with_metadata(bucket: str = "images", trip_id: Optional[str] = Query(None)):
    """List files alongside any metadata captured during upload."""
    try:
        return retrieval_service.list_files_with_metadata(bucket, trip_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _parse_raw_gpx_bytes(gpx_bytes: bytes) -> Tuple[List[List[float]], List[Dict[str, Any]], Optional[str]]:
    """
    Minimal GPX parser used as a fallback when analyzed data is unavailable.
    Returns coordinates, waypoints, and the first track name if present.
    """
    try:
        root = ET.fromstring(gpx_bytes)
    except Exception:
        return [], [], None

    def _tag_endswith(node, suffix: str) -> bool:
        return isinstance(node.tag, str) and node.tag.lower().endswith(suffix.lower())

    coords: List[List[float]] = []
    waypoints: List[Dict[str, Any]] = []
    track_name: Optional[str] = None

    # Track name
    for name_elem in root.iter():
        if _tag_endswith(name_elem, "name") and name_elem.text:
            track_name = name_elem.text.strip()
            break

    # Track points
    for trkpt in root.iter():
        if not _tag_endswith(trkpt, "trkpt"):
            continue
        try:
            lat = float(trkpt.attrib.get("lat"))
            lon = float(trkpt.attrib.get("lon"))
        except Exception:
            continue
        coords.append([lat, lon])

    # Waypoints
    for wpt in root.iter():
        if not _tag_endswith(wpt, "wpt"):
            continue
        try:
            lat = float(wpt.attrib.get("lat"))
            lon = float(wpt.attrib.get("lon"))
        except Exception:
            continue
        elev = None
        name_text = None
        for child in wpt:
            if _tag_endswith(child, "ele") and child.text:
                try:
                    elev = float(child.text)
                except Exception:
                    pass
            if _tag_endswith(child, "name") and child.text:
                name_text = child.text.strip()
        waypoints.append({"lat": lat, "lon": lon, "elev": elev, "note": name_text})

    return coords, waypoints, track_name

@router.get("/images/geo", response_model=List[GeotaggedImage])
async def get_geotagged_images(
    bucket: str = "images",
    minLon: Optional[float] = Query(None),
    minLat: Optional[float] = Query(None),
    maxLon: Optional[float] = Query(None),
    maxLat: Optional[float] = Query(None),
    trip_id: Optional[str] = Query(None)
):
    """
    Retrieve geotagged images (images with GPS coordinates).
    
    :param bucket: The bucket to query (default: 'images')
    :param minLon: Minimum longitude for bounding box filter
    :param minLat: Minimum latitude for bounding box filter
    :param maxLon: Maximum longitude for bounding box filter
    :param maxLat: Maximum latitude for bounding box filter
    :return: List of geotagged images with thumbnail URLs
    """
    try:
        bbox = None
        if all(v is not None for v in [minLon, minLat, maxLon, maxLat]):
            bbox = {
                'minLon': minLon,
                'minLat': minLat,
                'maxLon': maxLon,
                'maxLat': maxLat
            }
        
        return retrieval_service.list_geotagged_images(bucket, bbox, trip_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gpx/{filename}/analysis", response_model=GpxAnalysisResponse)
async def get_gpx_analysis(filename: str):
    """
    Retrieve analyzed GPX data (coordinates, summary, waypoints, rest points).
    Falls back to parsing the raw GPX when no analysis artifact is available.
    """
    metadata_doc = None
    metadata: Optional[FileMetadata] = None
    analysis_status: Optional[str] = None
    has_gpx_analysis: Optional[bool] = None
    analysis_object_key: Optional[str] = None
    analysis_bucket: str = "gps-analysis-data"
    bucket: str = "gps-data"
    track_summary: Optional[Dict[str, Any]] = None
    display_name: str = filename

    mongodb_adapter = retrieval_service.storage_manager.adapters.get('mongodb')
    if mongodb_adapter:
        try:
            metadata_doc = mongodb_adapter.load_data(filename, collection_name='file_metadata')
            if metadata_doc:
                metadata = FileMetadata(**metadata_doc)
                display_name = metadata.filename or metadata.object_key or filename
                analysis_status = metadata.analysis_status
                has_gpx_analysis = metadata.has_gpx_analysis
                analysis_object_key = metadata.analysis_object_key
                analysis_bucket = metadata.analysis_bucket or analysis_bucket
                bucket = metadata.bucket or bucket
                track_summary = metadata.track_summary
        except Exception as exc:
            logger.warning("Failed to load metadata for %s: %s", filename, exc)

    # Try to load the persisted analyzed track
    if analysis_object_key and analysis_status == 'success':
        try:
            analyzed_track = analysis_retrieval_service.get_analyzed_track(
                analysis_object_key,
                analysis_bucket=analysis_bucket
            )
            payload = analysis_retrieval_service.build_track_payload(
                analyzed_track,
                metadata_summary=track_summary
            )
            return GpxAnalysisResponse(
                filename=filename,
                display_name=display_name,
                analysis_status=analysis_status,
                source="analysis",
                has_gpx_analysis=has_gpx_analysis if has_gpx_analysis is not None else True,
                track_summary=payload.get("track_summary"),
                coordinates=payload.get("coordinates", []),
                waypoints=payload.get("waypoints", []),
                rest_points=payload.get("rest_points", [])
            )
        except Exception as exc:
            logger.error("Failed to load analyzed track %s: %s. Falling back to raw GPX.", filename, exc)

    # Fallback to raw GPX parsing
    raw_bytes = retrieval_service.get_file_bytes(bucket, filename)
    if raw_bytes is None:
        raise HTTPException(status_code=404, detail="GPX file not found")

    coordinates, waypoints, track_name = _parse_raw_gpx_bytes(raw_bytes)
    fallback_summary = track_summary or {
        "total_points": len(coordinates),
        "waypoints_count": len(waypoints),
    }

    if track_name and display_name == filename:
        display_name = track_name

    return GpxAnalysisResponse(
        filename=filename,
        display_name=display_name,
        analysis_status=analysis_status or 'not_attempted',
        source="raw_gpx",
        has_gpx_analysis=has_gpx_analysis,
        track_summary=fallback_summary,
        coordinates=coordinates,
        waypoints=waypoints,
        rest_points=[]
    )

@router.get("/files/{filename}")
async def get_file(filename: str, bucket: str = "gps-data"):
    """
    Retrieve a file from MinIO by filename.
    Returns raw bytes with appropriate media type based on file extension.
    """
    file_bytes = retrieval_service.get_file_bytes(bucket, filename)
    if file_bytes is None:
        raise HTTPException(status_code=404, detail="File not found in MinIO")

    # Detect media type from filename extension
    import mimetypes
    media_type, _ = mimetypes.guess_type(filename)
    
    # Default to octet-stream if type cannot be determined
    if not media_type:
        media_type = "application/octet-stream"
    
    # Return raw bytes with proper media type
    return Response(content=file_bytes, media_type=media_type)
