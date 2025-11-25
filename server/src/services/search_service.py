from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel
from pymongo.collection import Collection

from src.models.annotations import PhotoAnnotations
from src.models.file_metadata import GPSData
from src.models.search import (
    SearchFilters,
    SearchPresetCreateRequest,
    SearchPresetResponse,
    SearchPresetUpdateRequest,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    SearchSortField,
    SortOrder,
)
from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager

DEFAULT_BUCKET = "images"
MAX_DATE_RANGE_DAYS = 370
DEFAULT_NEAR_RADIUS_KM = 5.0
MAX_NEAR_RADIUS_KM = 250.0
NOTE_REGEX = re.compile(r"\\S")


class PhotoSearchService:
    """Encapsulates MongoDB queries for advanced photo search and presets."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.storage_manager = StorageManager()
        try:
            mongodb_adapter = AdapterFactory.create_mongodb_adapter()
            self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        except Exception as exc:  # pragma: no cover - adapter bootstrap
            self.logger.warning("MongoDB adapter not initialized for search: %s", exc)
        self._ensure_indexes()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search_photos(self, payload: SearchRequest) -> SearchResponse:
        collection = self._get_file_collection()
        filters = payload.filters or SearchFilters()
        query = self._build_query(payload.trip_id, filters)
        projection = self._build_projection(bool(filters.query))
        sort_spec = self._build_sort_spec(payload.sort_by, payload.sort_order, bool(filters.query))

        timer_start = perf_counter()
        cursor = collection.find(query, projection)
        if sort_spec:
            cursor = cursor.sort(sort_spec)
        if payload.offset:
            cursor = cursor.skip(payload.offset)
        cursor = cursor.limit(payload.limit)
        documents = list(cursor)
        total = collection.count_documents(query)
        took_ms = int((perf_counter() - timer_start) * 1000)

        results = [self._serialize_document(doc) for doc in documents]
        has_more = payload.offset + len(results) < total
        return SearchResponse(
            results=results,
            total=total,
            limit=payload.limit,
            offset=payload.offset,
            has_more=has_more,
            took_ms=took_ms,
        )

    def list_presets(self, trip_id: str, user_id: Optional[str]) -> List[SearchPresetResponse]:
        collection = self._get_preset_collection()
        query: Dict[str, Any] = {"trip_id": trip_id}
        if user_id:
            query["user_id"] = user_id
        cursor = collection.find(query).sort("created_at", ASCENDING)
        return [self._serialize_preset(doc) for doc in cursor]

    def create_preset(self, payload: SearchPresetCreateRequest) -> SearchPresetResponse:
        collection = self._get_preset_collection()
        now = datetime.now(timezone.utc)
        document: Dict[str, Any] = {
            "name": payload.name.strip(),
            "trip_id": payload.trip_id,
            "user_id": payload.user_id,
            "filters": payload.filters.model_dump(exclude_none=True),
            "sort_by": payload.sort_by.value,
            "sort_order": payload.sort_order.value,
            "created_at": now,
            "updated_at": now,
        }
        result = collection.insert_one(document)
        document["_id"] = result.inserted_id
        return self._serialize_preset(document)

    def update_preset(self, preset_id: str, payload: SearchPresetUpdateRequest) -> SearchPresetResponse:
        collection = self._get_preset_collection()
        obj_id = self._parse_object_id(preset_id)
        now = datetime.now(timezone.utc)
        update_doc = {
            "name": payload.name.strip(),
            "filters": payload.filters.model_dump(exclude_none=True),
            "sort_by": payload.sort_by.value,
            "sort_order": payload.sort_order.value,
            "updated_at": now,
        }
        result = collection.update_one({"_id": obj_id}, {"$set": update_doc})
        if result.matched_count == 0:
            raise ValueError("Preset not found")
        document = collection.find_one({"_id": obj_id})
        if not document:
            raise ValueError("Preset not found")
        return self._serialize_preset(document)

    def delete_preset(self, preset_id: str) -> bool:
        collection = self._get_preset_collection()
        obj_id = self._parse_object_id(preset_id)
        result = collection.delete_one({"_id": obj_id})
        return result.deleted_count > 0

    # ------------------------------------------------------------------
    # Query construction helpers
    # ------------------------------------------------------------------

    def _build_query(self, trip_id: str, filters: SearchFilters) -> Dict[str, Any]:
        query: Dict[str, Any] = {
            "bucket": DEFAULT_BUCKET,
            "trip_id": trip_id,
            "status": {"$ne": "deleted"},
        }
        and_clauses: List[Dict[str, Any]] = []

        normalized_tags = self._normalize_string_list(filters.tags)
        if normalized_tags:
            and_clauses.append({"annotations.tags": {"$all": normalized_tags}})

        if filters.mood:
            and_clauses.append({"annotations.mood": {"$in": [value.value for value in filters.mood]}})
        if filters.activity:
            and_clauses.append({"annotations.activity": {"$in": [value.value for value in filters.activity]}})
        if filters.weather:
            and_clauses.append({"annotations.weather": {"$in": [value.value for value in filters.weather]}})
        if filters.privacy:
            and_clauses.append({"annotations.privacy": {"$in": [value.value for value in filters.privacy]}})

        companions = self._normalize_string_list(filters.companions)
        if companions:
            and_clauses.append({"annotations.companions": {"$all": companions}})

        gear = self._normalize_string_list(filters.gear)
        if gear:
            and_clauses.append({"annotations.gear": {"$all": gear}})

        if filters.only_highlights:
            and_clauses.append({"annotations.is_trip_highlight": True})

        if filters.has_annotations:
            and_clauses.append({"annotations": {"$exists": True, "$ne": None}})

        if filters.has_notes:
            and_clauses.append({
                "$or": [
                    {"note": {"$type": "string", "$regex": NOTE_REGEX}},
                    {"note_title": {"$type": "string", "$regex": NOTE_REGEX}},
                ]
            })

        if filters.has_gps:
            and_clauses.append({"gps.latitude": {"$ne": None}})
            and_clauses.append({"gps.longitude": {"$ne": None}})

        self._append_date_range(and_clauses, filters)
        self._append_altitude_range(and_clauses, filters)
        self._append_quality_filters(and_clauses, filters)
        self._append_nearby_filter(and_clauses, filters)

        if filters.query:
            text_query = filters.query.strip()
            if text_query:
                query["$text"] = {"$search": text_query}

        if and_clauses:
            query.setdefault("$and", []).extend(and_clauses)

        return query

    def _append_date_range(self, and_clauses: List[Dict[str, Any]], filters: SearchFilters) -> None:
        if not filters.date_from and not filters.date_to:
            return
        date_from = filters.date_from
        date_to = filters.date_to
        if date_from and date_to and (date_to - date_from).days > MAX_DATE_RANGE_DAYS:
            raise ValueError("Requested date range is too large")
        range_filter: Dict[str, Any] = {}
        if date_from:
            start_dt = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
            range_filter["$gte"] = start_dt
        if date_to:
            end_dt = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
            range_filter["$lt"] = end_dt
        and_clauses.append({"captured_at": range_filter})

    def _append_altitude_range(self, and_clauses: List[Dict[str, Any]], filters: SearchFilters) -> None:
        if filters.altitude_min is None and filters.altitude_max is None:
            return
        range_filter: Dict[str, Any] = {}
        if filters.altitude_min is not None:
            range_filter["$gte"] = filters.altitude_min
        if filters.altitude_max is not None:
            range_filter["$lte"] = filters.altitude_max
        and_clauses.append({"gps.altitude": range_filter})

    def _append_quality_filters(self, and_clauses: List[Dict[str, Any]], filters: SearchFilters) -> None:
        if filters.quality_rating_min is not None or filters.quality_rating_max is not None:
            rating_filter: Dict[str, Any] = {}
            if filters.quality_rating_min is not None:
                rating_filter["$gte"] = filters.quality_rating_min
            if filters.quality_rating_max is not None:
                rating_filter["$lte"] = filters.quality_rating_max
            and_clauses.append({"annotations.quality_rating": rating_filter})

        if filters.difficulty_min is not None or filters.difficulty_max is not None:
            diff_filter: Dict[str, Any] = {}
            if filters.difficulty_min is not None:
                diff_filter["$gte"] = filters.difficulty_min
            if filters.difficulty_max is not None:
                diff_filter["$lte"] = filters.difficulty_max
            and_clauses.append({"annotations.difficulty": diff_filter})

    def _append_nearby_filter(self, and_clauses: List[Dict[str, Any]], filters: SearchFilters) -> None:
        if filters.near_lat is None or filters.near_lon is None:
            return
        radius = filters.near_radius_km or DEFAULT_NEAR_RADIUS_KM
        radius = min(radius, MAX_NEAR_RADIUS_KM)
        lat_delta = radius / 111.0
        lon_scale = max(math.cos(math.radians(filters.near_lat)), 0.01)
        lon_delta = radius / (111.0 * lon_scale)
        and_clauses.append({
            "gps.latitude": {
                "$gte": filters.near_lat - lat_delta,
                "$lte": filters.near_lat + lat_delta,
            }
        })
        and_clauses.append({
            "gps.longitude": {
                "$gte": filters.near_lon - lon_delta,
                "$lte": filters.near_lon + lon_delta,
            }
        })

    def _build_projection(self, include_text_score: bool) -> Dict[str, Any]:
        projection = {
            "object_key": 1,
            "bucket": 1,
            "captured_at": 1,
            "created_at": 1,
            "annotated_at": 1,
            "last_edited_at": 1,
            "note": 1,
            "note_title": 1,
            "annotations": 1,
            "gps": 1,
        }
        if include_text_score:
            projection["score"] = {"$meta": "textScore"}
        return projection

    def _build_sort_spec(
        self,
        sort_by: SearchSortField,
        sort_order: SortOrder,
        include_text_score: bool,
    ) -> List[Tuple[str, Any]]:
        order = ASCENDING if sort_order == SortOrder.ASC else DESCENDING
        field_map = {
            SearchSortField.CAPTURED_AT: "captured_at",
            SearchSortField.CREATED_AT: "created_at",
            SearchSortField.UPDATED_AT: "last_edited_at",
            SearchSortField.ANNOTATED_AT: "annotated_at",
        }
        sort_list: List[Tuple[str, Any]] = []
        if include_text_score:
            sort_list.append(("score", {"$meta": "textScore"}))
        sort_field = field_map.get(sort_by, "captured_at")
        sort_list.append((sort_field, order))
        sort_list.append(("_id", order))
        return sort_list

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------

    def _serialize_document(self, document: Dict[str, Any]) -> SearchResultItem:
        annotations_data = document.get('annotations') or None
        annotations: Optional[PhotoAnnotations] = None
        if annotations_data:
            try:
                annotations = PhotoAnnotations(**annotations_data)
            except Exception:  # pragma: no cover - tolerant of legacy docs
                annotations = None
        gps_data = document.get('gps') or None
        gps = GPSData(**gps_data) if gps_data else None
        object_key = document.get('object_key', '')
        bucket = document.get('bucket', DEFAULT_BUCKET)
        thumbnail_url = self._build_thumbnail_url(object_key, bucket)
        score_value = document.get('score')
        return SearchResultItem(
            metadata_id=str(document.get('_id')),
            object_key=object_key,
            bucket=bucket,
            thumbnail_url=thumbnail_url,
            captured_at=self._isoformat(document.get('captured_at')),
            created_at=self._isoformat(document.get('created_at')),
            annotated_at=self._isoformat(document.get('annotated_at')),
            last_edited_at=self._isoformat(document.get('last_edited_at')),
            note=document.get('note'),
            note_title=document.get('note_title'),
            annotations=annotations,
            gps=gps,
            mood=annotations.mood if annotations else None,
            activity=annotations.activity if annotations else None,
            weather=annotations.weather if annotations else None,
            score=float(score_value) if isinstance(score_value, (int, float)) else None,
        )

    def _serialize_preset(self, document: Dict[str, Any]) -> SearchPresetResponse:
        filters_data = document.get('filters') or {}
        filters = SearchFilters(**filters_data)
        return SearchPresetResponse(
            id=str(document.get('_id')),
            trip_id=document.get('trip_id'),
            user_id=document.get('user_id'),
            name=document.get('name'),
            filters=filters,
            sort_by=SearchSortField(document.get('sort_by', SearchSortField.CAPTURED_AT.value)),
            sort_order=SortOrder(document.get('sort_order', SortOrder.ASC.value)),
            created_at=self._isoformat(document.get('created_at')) or '',
            updated_at=self._isoformat(document.get('updated_at')) or '',
        )

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _ensure_indexes(self) -> None:
        try:
            collection = self._get_file_collection()
        except RuntimeError:
            return
        try:
            indexes = [
                IndexModel([
                    ("trip_id", ASCENDING),
                    ("bucket", ASCENDING),
                    ("captured_at", DESCENDING),
                ], name="trip_bucket_captured", background=True),
                IndexModel([("annotations.tags", ASCENDING)], name="annotation_tags", background=True),
                IndexModel([("annotations.mood", ASCENDING)], name="annotation_mood", background=True),
                IndexModel([("annotations.activity", ASCENDING)], name="annotation_activity", background=True),
                IndexModel([("annotations.weather", ASCENDING)], name="annotation_weather", background=True),
                IndexModel([("gps.latitude", ASCENDING), ("gps.longitude", ASCENDING)], name="gps_lat_lon", background=True),
                IndexModel([("note", TEXT), ("note_title", TEXT), ("annotations.tags", TEXT)], name="photo_text_search", default_language="english"),
            ]
            collection.create_indexes(indexes)
        except Exception as exc:  # pragma: no cover - index creation best effort
            self.logger.warning("Failed to create search indexes: %s", exc)

    def _get_file_collection(self) -> Collection:
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        return adapter.get_collection('file_metadata')

    def _get_preset_collection(self) -> Collection:
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        return adapter.get_collection('search_presets')

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------

    def _normalize_string_list(self, values: Optional[List[str]]) -> Optional[List[str]]:
        if not values:
            return None
        normalized: List[str] = []
        seen = set()
        for value in values:
            if value is None:
                continue
            cleaned = value.strip()
            if not cleaned:
                continue
            lowered = cleaned.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized.append(cleaned)
        return normalized or None

    def _build_thumbnail_url(self, object_key: str, bucket: str) -> str:
        from urllib.parse import quote

        safe_key = quote(object_key or '', safe='')
        return f"/api/files/{safe_key}?bucket={bucket or DEFAULT_BUCKET}"

    def _isoformat(self, value: Any) -> Optional[str]:
        if isinstance(value, datetime):
            return value.isoformat()
        return None

    def _parse_object_id(self, preset_id: str) -> ObjectId:
        try:
            return ObjectId(preset_id)
        except Exception as exc:
            raise ValueError("Invalid preset id") from exc
