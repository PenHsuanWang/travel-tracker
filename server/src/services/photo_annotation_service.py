from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.models.annotations import (
    AnnotationListMergeMode,
    PhotoAnnotations,
    PhotoAnnotationsPatch,
)
from src.models.file_metadata import FileMetadata
from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager


class PhotoAnnotationService:
    """Service responsible for CRUD operations on structured annotations."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.storage_manager = StorageManager()
        try:
            mongodb_adapter = AdapterFactory.create_mongodb_adapter()
            self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        except Exception as exc:
            self.logger.warning("MongoDB adapter not initialized: %s", exc)

    def _get_collection(self):
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        return adapter.get_collection('file_metadata')

    def _load_metadata(self, metadata_id: str) -> Dict[str, Any]:
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        document = adapter.load_data(metadata_id, collection_name='file_metadata')
        if not document:
            raise ValueError("Photo metadata not found")

        parsed = FileMetadata(**document)
        payload = parsed.model_dump()
        if parsed.created_at:
            payload['created_at'] = parsed.created_at.isoformat()
        if parsed.captured_at:
            payload['captured_at'] = parsed.captured_at.isoformat()
        if parsed.annotated_at:
            payload['annotated_at'] = parsed.annotated_at.isoformat()
        if parsed.last_edited_at:
            payload['last_edited_at'] = parsed.last_edited_at.isoformat()
        return payload

    def _safe_parse_annotations(self, data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not data:
            return {}
        try:
            return PhotoAnnotations(**data).model_dump(exclude_none=True)
        except Exception as exc:
            self.logger.warning("Failed to parse annotations payload: %s", exc)
            return {}

    def _normalize_text_list(self, values: Optional[List[str]]) -> Optional[List[str]]:
        if values is None:
            return None
        normalized: List[str] = []
        seen = set()
        for value in values:
            if value is None:
                continue
            cleaned = value.strip()
            if not cleaned:
                continue
            lowered = cleaned
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized.append(cleaned)
        return normalized

    def _normalize_patch(self, patch: PhotoAnnotationsPatch) -> Dict[str, Any]:
        raw = patch.model_dump(exclude_unset=True)
        normalized: Dict[str, Any] = {}
        for key, value in raw.items():
            if key in {'tags', 'companions', 'gear'}:
                normalized[key] = self._normalize_text_list(value) if value is not None else None
            elif isinstance(value, str):
                normalized[key] = value.strip()
            else:
                normalized[key] = value
        return normalized

    def _validate_annotations(self, annotations: Dict[str, Any]) -> Dict[str, Any]:
        if not annotations:
            return {}
        validated = PhotoAnnotations(**annotations)
        return validated.model_dump(exclude_none=True)

    def _merge_simple(self, existing: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        merged = {**existing}
        for key, value in updates.items():
            if value is None:
                merged.pop(key, None)
            else:
                merged[key] = value
        return merged

    def _merge_list_value(
        self,
        field: str,
        existing: Dict[str, Any],
        incoming: Optional[List[str]],
        mode: AnnotationListMergeMode,
    ) -> Dict[str, Any]:
        merged = {**existing}
        if incoming is None:
            merged.pop(field, None)
            return merged
        existing_values = merged.get(field)
        if mode == AnnotationListMergeMode.APPEND and isinstance(existing_values, list):
            base = existing_values.copy()
            for item in incoming:
                if item not in base:
                    base.append(item)
            merged[field] = base
            return merged
        merged[field] = incoming
        return merged

    def get_annotations(self, metadata_id: str) -> Dict[str, Any]:
        return self._load_metadata(metadata_id)

    def update_annotations(
        self,
        metadata_id: str,
        patch: PhotoAnnotationsPatch,
        annotated_by: Optional[str] = None,
        auto_annotated: Optional[bool] = None,
    ) -> Dict[str, Any]:
        collection = self._get_collection()
        document = collection.find_one({'_id': metadata_id})
        if not document:
            raise ValueError("Photo metadata not found")

        current = self._safe_parse_annotations(document.get('annotations'))
        normalized_patch = self._normalize_patch(patch)
        merged = self._merge_simple(current, normalized_patch)
        validated = self._validate_annotations(merged)

        now = datetime.now(timezone.utc)
        update_doc: Dict[str, Any] = {
            'last_edited_at': now
        }
        unset_doc: Dict[str, Any] = {}

        if validated:
            update_doc['annotations'] = validated
        else:
            unset_doc['annotations'] = ""

        if not document.get('annotated_at') and validated:
            update_doc['annotated_at'] = now
        if annotated_by is not None:
            update_doc['annotated_by'] = annotated_by
        elif document.get('annotated_by') is None and validated:
            update_doc['annotated_by'] = 'manual'
        if auto_annotated is not None:
            update_doc['auto_annotated'] = bool(auto_annotated)

        update_ops: Dict[str, Any] = {'$set': update_doc}
        if unset_doc:
            update_ops['$unset'] = unset_doc

        result = collection.update_one({'_id': metadata_id}, update_ops)
        if result.matched_count == 0:
            raise ValueError("Photo metadata not found")

        return self._load_metadata(metadata_id)

    def bulk_update_annotations(
        self,
        metadata_ids: List[str],
        patch: PhotoAnnotationsPatch,
        tag_mode: AnnotationListMergeMode,
        companion_mode: AnnotationListMergeMode,
        gear_mode: AnnotationListMergeMode,
        annotated_by: Optional[str] = None,
        auto_annotated: Optional[bool] = None,
    ) -> Dict[str, Any]:
        if not metadata_ids:
            raise ValueError("metadata_ids cannot be empty")

        collection = self._get_collection()
        normalized_patch = self._normalize_patch(patch)
        if not normalized_patch:
            raise ValueError("No annotation fields provided")

        cursor = collection.find({'_id': {'$in': metadata_ids}})
        documents = {doc['_id']: doc for doc in cursor}
        updated = 0
        now = datetime.now(timezone.utc)

        for metadata_id in metadata_ids:
            document = documents.get(metadata_id)
            if not document:
                continue
            current = self._safe_parse_annotations(document.get('annotations'))
            merged = {**current}

            for key, value in normalized_patch.items():
                if key == 'tags':
                    merged = self._merge_list_value('tags', merged, value, tag_mode)
                elif key == 'companions':
                    merged = self._merge_list_value('companions', merged, value, companion_mode)
                elif key == 'gear':
                    merged = self._merge_list_value('gear', merged, value, gear_mode)
                elif value is None:
                    merged.pop(key, None)
                else:
                    merged[key] = value

            validated = self._validate_annotations(merged)
            update_doc: Dict[str, Any] = {'last_edited_at': now}
            unset_doc: Dict[str, Any] = {}

            if validated:
                update_doc['annotations'] = validated
            else:
                unset_doc['annotations'] = ""

            if not document.get('annotated_at') and validated:
                update_doc['annotated_at'] = now
            if annotated_by is not None:
                update_doc['annotated_by'] = annotated_by
            elif document.get('annotated_by') is None and validated:
                update_doc['annotated_by'] = 'bulk'
            if auto_annotated is not None:
                update_doc['auto_annotated'] = bool(auto_annotated)

            update_ops: Dict[str, Any] = {'$set': update_doc}
            if unset_doc:
                update_ops['$unset'] = unset_doc

            result = collection.update_one({'_id': metadata_id}, update_ops)
            if result.matched_count > 0:
                updated += 1

        return {'updated': updated, 'requested': len(metadata_ids)}
