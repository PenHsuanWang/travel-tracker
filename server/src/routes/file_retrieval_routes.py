"""File retrieval endpoints and GPX analysis access.

Includes routes to list files, fetch metadata, retrieve raw files, and
to obtain GPX analysis results (with a fallback to raw GPX parsing).
"""

import logging
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Response, Query, Depends  # type: ignore[import-not-found]
from pydantic import BaseModel  # type: ignore[import-not-found]

from src.services.file_retrieval_service import FileRetrievalService
from src.services.gpx_analysis_retrieval_service import GpxAnalysisRetrievalService
from src.services.gpx_analysis_service import GpxAnalysisService
from src.services.photo_note_service import PhotoNoteService
from src.services.trip_service import TripService
from src.models.file_metadata import FileMetadata, FileMetadataResponse
from src.auth import get_current_user
from src.models.user import User

router = APIRouter()

retrieval_service = FileRetrievalService()
analysis_retrieval_service = GpxAnalysisRetrievalService()
photo_note_service = PhotoNoteService()

logger = logging.getLogger(__name__)


class GeotaggedImage(BaseModel):
    object_key: str
    original_filename: str
    lat: float
    lon: float
    thumb_url: str
    metadata_id: Optional[str] = None
    captured_at: Optional[str] = None
    captured_source: Optional[str] = None
    note: Optional[str] = None
    note_title: Optional[str] = None
    order_index: Optional[int] = None


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


class PhotoNotePayload(BaseModel):
    note: Optional[str] = None
    note_title: Optional[str] = None


class PhotoOrderPayload(BaseModel):
    order_index: int


def _load_metadata_doc_or_404(metadata_id: str) -> Tuple[str, Dict[str, Any]]:
    adapter = photo_note_service.storage_manager.adapters.get('mongodb')
    if not adapter:
        raise HTTPException(status_code=500, detail="MongoDB adapter not configured")

    # Primary lookup by _id
    metadata_doc = adapter.load_data(metadata_id, collection_name='file_metadata')
    if metadata_doc:
        return metadata_id, metadata_doc

    # Fallback lookup by object_key for legacy records whose _id differs
    collection = adapter.get_collection('file_metadata')
    fallback_doc = collection.find_one({"object_key": metadata_id})
    if fallback_doc:
        return str(fallback_doc.get("_id")), fallback_doc

    raise HTTPException(status_code=404, detail="GPX metadata not found")


def _assert_waypoint_edit_authorized(metadata_doc: Dict[str, Any], current_user: User):
    trip_id = metadata_doc.get("trip_id")
    uploader_id = metadata_doc.get("uploader_id")
    current_user_id = str(current_user.id)

    if trip_id:
        trip_service = TripService()
        trip = trip_service.get_trip(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        owner_ok = bool(trip.owner_id) and str(trip.owner_id) == current_user_id
        member_ok = any(str(mid) == current_user_id for mid in (trip.member_ids or []))
        if not (owner_ok or member_ok):
            raise HTTPException(status_code=403, detail="Not authorized to edit waypoint notes for this trip")
    else:
        # Fallback: require uploader ownership when the GPX is not linked to a trip.
        if uploader_id and str(uploader_id) != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit waypoint notes for this file")

@router.get("/list-files", response_model=List[str])
async def list_files(bucket: str = "gps-data", trip_id: Optional[str] = Query(None)):
    """
    List object keys in the specified MinIO bucket.
    Defaults to 'gps-data'.
    """
    try:
        keys = retrieval_service.list_files(bucket, trip_id=trip_id)
        return keys
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list-files/detail", response_model=List[FileMetadataResponse])
async def list_files_with_metadata(
    bucket: str = "images",
    trip_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """List files with metadata, including computed `can_delete` permission."""
    try:
        return retrieval_service.list_files_with_metadata(
            bucket_name=bucket, trip_id=trip_id, current_user=current_user
        )
    except Exception as e:
        logger.error(f"Failed to list files with metadata: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve file list.")



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
        time_text = None
        for child in wpt:
            if _tag_endswith(child, "ele") and child.text:
                try:
                    elev = float(child.text)
                except Exception:
                    pass
            if _tag_endswith(child, "name") and child.text:
                name_text = child.text.strip()
            if _tag_endswith(child, "time") and child.text:
                time_text = child.text.strip()
        waypoints.append({
            "lat": lat, 
            "lon": lon, 
            "elev": elev, 
            "note": name_text,
            "time": time_text
        })

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


@router.get("/gpx/{filename:path}/analysis", response_model=GpxAnalysisResponse)
async def get_gpx_analysis(filename: str, trip_id: Optional[str] = Query(None)):
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
            # Try loading by _id first
            metadata_doc = mongodb_adapter.load_data(filename, collection_name='file_metadata')
            if not metadata_doc:
                # Fallback to loading by object_key
                collection = mongodb_adapter.get_collection('file_metadata')
                metadata_doc = collection.find_one({"object_key": filename})

            if metadata_doc:
                logger.info("Found metadata for %s. Checking for overrides.", filename)
                if 'waypoint_overrides' in metadata_doc and metadata_doc['waypoint_overrides']:
                    logger.info("Waypoint overrides found for %s: %s", filename, metadata_doc['waypoint_overrides'])
                else:
                    logger.info("No waypoint overrides found for %s.", filename)

                # Add waypoint_overrides to the model if it's not there
                if 'waypoint_overrides' not in metadata_doc:
                    metadata_doc['waypoint_overrides'] = {}
                metadata = FileMetadata(**metadata_doc)
            else:
                logger.info("No metadata document found for %s. Proceeding without.", filename)
                if trip_id and metadata.trip_id and metadata.trip_id != trip_id:
                    raise HTTPException(status_code=404, detail="GPX file not found for this trip")
                if trip_id and not metadata.trip_id:
                    raise HTTPException(status_code=404, detail="GPX file not scoped to this trip")
                if metadata.trip_id and trip_id is None:
                    raise HTTPException(status_code=400, detail="trip_id is required to fetch trip-scoped GPX data")
                display_name = metadata.filename or metadata.object_key or filename
                analysis_status = metadata.analysis_status
                has_gpx_analysis = metadata.has_gpx_analysis
                analysis_object_key = metadata.analysis_object_key
                analysis_bucket = metadata.analysis_bucket or analysis_bucket
                bucket = metadata.bucket or bucket
                track_summary = metadata.track_summary
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Failed to load metadata for %s: %s", filename, exc)

    if trip_id and metadata is None:
        raise HTTPException(status_code=404, detail="GPX file not found for this trip")

    def _apply_waypoint_overrides(waypoints: List[Dict[str, Any]], doc: Optional[Dict[str, Any]]):
        if not doc or 'waypoint_overrides' not in doc:
            return waypoints
        
        overrides = doc['waypoint_overrides']
        for i, wp in enumerate(waypoints):
            override = overrides.get(str(i))
            if override:
                if 'note' in override:
                    wp['note'] = override['note']
                if 'note_title' in override:
                    wp['name'] = override['note_title']
        return waypoints

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
            
            waypoints = _apply_waypoint_overrides(payload.get("waypoints", []), metadata_doc)

            return GpxAnalysisResponse(
                filename=filename,
                display_name=display_name,
                analysis_status=analysis_status,
                source="analysis",
                has_gpx_analysis=has_gpx_analysis if has_gpx_analysis is not None else True,
                track_summary=payload.get("track_summary"),
                coordinates=payload.get("coordinates", []),
                waypoints=waypoints,
                rest_points=payload.get("rest_points", [])
            )
        except Exception as exc:
            logger.error("Failed to load analyzed track %s: %s. Falling back to raw GPX.", filename, exc)

    # Fallback to raw GPX parsing
    raw_bytes = retrieval_service.get_file_bytes(bucket, filename)
    if raw_bytes is None:
        raise HTTPException(status_code=404, detail="GPX file not found")

    # Attempt to re-analyze on the fly to get full stats/profile if possible
    # This handles cases where the pickle is missing/broken or metadata is incomplete (old files)
    try:
        analysis_result = GpxAnalysisService.analyze_gpx_data(raw_bytes, filename)
        
        fresh_summary = analysis_result.summary
        if track_summary:
            fresh_summary = {**track_summary, **fresh_summary}

        payload = analysis_retrieval_service.build_track_payload(
            analysis_result.analyzed_track, 
            metadata_summary=fresh_summary
        )
        
        waypoints = _apply_waypoint_overrides(payload.get("waypoints", []), metadata_doc)

        return GpxAnalysisResponse(
            filename=filename,
            display_name=display_name,
            analysis_status='recalculated_on_fly',
            source="analysis_on_fly",
            has_gpx_analysis=True,
            track_summary=payload.get("track_summary"),
            coordinates=payload.get("coordinates", []),
            waypoints=waypoints,
            rest_points=payload.get("rest_points", [])
        )
    except Exception as exc:
        logger.warning("On-the-fly analysis failed for %s: %s. Using simple fallback.", filename, exc)

    coordinates, waypoints, track_name = _parse_raw_gpx_bytes(raw_bytes)
    waypoints = _apply_waypoint_overrides(waypoints, metadata_doc)
    
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

@router.get("/files/{filename:path}")
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


@router.patch("/photos/{metadata_id:path}/note")
async def update_photo_note(metadata_id: str, payload: PhotoNotePayload, current_user: User = Depends(get_current_user)):
    """Update the note/note_title for a photo metadata entry."""
    # First, get the metadata for the file
    metadata = retrieval_service.storage_manager.load_data(metadata_id, collection_name='file_metadata')
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Now, check for permissions
    trip_id = metadata.get("trip_id")
    if trip_id:
        trip_service = TripService()
        trip = trip_service.get_trip(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Associated trip not found")

        is_owner = str(trip.owner_id) == str(current_user.id)
        member_ids = [str(m) for m in trip.member_ids] if trip.member_ids else []
        is_member = str(current_user.id) in member_ids

        if not (is_owner or is_member):
            raise HTTPException(status_code=403, detail="Not authorized to edit notes for this trip")
    else:
        # If no trip is associated, only the original uploader can edit.
        if str(metadata.get("uploader_id")) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to edit this file's notes")

    try:
        updated = photo_note_service.update_note(
            metadata_id,
            note=payload.note,
            note_title=payload.note_title,
        )
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/photos/{metadata_id:path}/order")
async def update_photo_order(metadata_id: str, payload: PhotoOrderPayload, current_user: User = Depends(get_current_user)):
    """
    Update the order index for a photo metadata entry.
    """
    try:
        updated = photo_note_service.update_order(metadata_id, order_index=payload.order_index)
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/gpx/metadata/{metadata_id:path}/waypoint/{waypoint_index}")
async def update_waypoint_note(
    metadata_id: str,
    waypoint_index: int,
    payload: PhotoNotePayload,
    current_user: User = Depends(get_current_user)
):
    """
    Update the note for a specific waypoint within a GPX file's metadata.
    """
    logger.info(
        "Attempting to update waypoint note for metadata_id: %s, index: %s",
        metadata_id,
        waypoint_index
    )
    logger.debug("Payload: %s", payload.model_dump_json())
    try:
        resolved_id, metadata_doc = _load_metadata_doc_or_404(metadata_id)
        logger.info("Resolved metadata_id %s to _id %s", metadata_id, resolved_id)
        _assert_waypoint_edit_authorized(metadata_doc, current_user)

        updated = photo_note_service.update_waypoint_note(
            resolved_id,
            waypoint_index,
            note=payload.note,
            note_title=payload.note_title,
        )
        logger.info(
            "Successfully updated waypoint note for _id: %s, index: %s",
            resolved_id,
            waypoint_index
        )
        return updated
    except ValueError as exc:
        logger.error("ValueError in update_waypoint_note: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Exception in update_waypoint_note: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
