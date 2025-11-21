import datetime

import pytest  # type: ignore[import-not-found]

from src.services.file_retrieval_service import FileRetrievalService
from src.utils import adapter_factory


class FakeMinioAdapter:
    def __init__(self, keys):
        self._keys = keys

    def list_keys(self, prefix: str = "", **kwargs):
        return [key for key in self._keys if key.startswith(prefix)]


class FakeCollection:
    def __init__(self, documents):
        self._documents = documents

    def find(self, query):
        # Basic filter on bucket to mimic expected behaviour
        bucket = query.get("bucket")
        if bucket is None:
            return list(self._documents)
        return [doc for doc in self._documents if doc.get("bucket") == bucket]


class FakeMongoAdapter:
    def __init__(self, documents):
        self._collection = FakeCollection(documents)

    def get_collection(self, name: str):
        return self._collection


@pytest.fixture
def metadata_document():
    return {
        "_id": "image-with-metadata.jpg",
        "object_key": "image-with-metadata.jpg",
        "bucket": "images",
        "filename": "image-with-metadata.jpg",
        "original_filename": "vacation.jpg",
        "size": 2048,
        "mime_type": "image/jpeg",
        "file_extension": "jpg",
        "exif": {},
        "gps": {
            "latitude": 10.0,
            "longitude": 20.0,
            "altitude": None,
            "latitude_ref": None,
            "longitude_ref": None,
        },
        "date_taken": "2024-01-02",
        "camera_make": "Canon",
        "camera_model": "5D",
        "created_at": datetime.datetime(2024, 1, 3, 12, 0, 0),
        "uploader_id": "test-user",
        "status": "active",
    }


def test_list_files_with_metadata_merges_storage_and_metadata(monkeypatch, metadata_document):
    fake_minio = FakeMinioAdapter({"image-with-metadata.jpg", "orphan-image.jpg"})
    fake_mongo = FakeMongoAdapter([metadata_document])

    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_minio_adapter", lambda: fake_minio)
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: fake_mongo)

    service = FileRetrievalService()
    results = service.list_files_with_metadata("images")

    assert len(results) == 2

    result_index = {item["object_key"]: item for item in results}

    metadata_item = result_index["image-with-metadata.jpg"]
    assert metadata_item["has_metadata"] is True
    assert metadata_item["has_storage_object"] is True
    assert metadata_item["warnings"] == []
    assert metadata_item["metadata"]["id"] == "image-with-metadata.jpg"
    assert isinstance(metadata_item["metadata"]["created_at"], str)

    orphan_item = result_index["orphan-image.jpg"]
    assert orphan_item["metadata"] is None
    assert orphan_item["has_metadata"] is False
    assert orphan_item["has_storage_object"] is True
    assert orphan_item["warnings"] == ["metadata_missing"]


def test_list_files_with_metadata_filters_by_trip(monkeypatch):
    fake_minio = FakeMinioAdapter(
        {
            "trip-a/photo-a.jpg",
            "trip-b/photo-b.jpg",
            "trip-a/photo-c.jpg",
        }
    )
    trip_a_doc = {
        "_id": "trip-a/photo-a.jpg",
        "object_key": "trip-a/photo-a.jpg",
        "bucket": "images",
        "filename": "trip-a/photo-a.jpg",
        "original_filename": "photo-a.jpg",
        "size": 1024,
        "mime_type": "image/jpeg",
        "file_extension": "jpg",
        "created_at": datetime.datetime(2024, 1, 1, 12, 0, 0),
        "trip_id": "trip-a",
        "status": "active",
    }
    trip_b_doc = {
        "_id": "trip-b/photo-b.jpg",
        "object_key": "trip-b/photo-b.jpg",
        "bucket": "images",
        "filename": "trip-b/photo-b.jpg",
        "original_filename": "photo-b.jpg",
        "size": 2048,
        "mime_type": "image/jpeg",
        "file_extension": "jpg",
        "created_at": datetime.datetime(2024, 1, 2, 12, 0, 0),
        "trip_id": "trip-b",
        "status": "active",
    }
    fake_mongo = FakeMongoAdapter([trip_a_doc, trip_b_doc])

    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_minio_adapter", lambda: fake_minio)
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: fake_mongo)

    service = FileRetrievalService()
    results = service.list_files_with_metadata("images", trip_id="trip-a")

    assert {item["object_key"] for item in results} == {"trip-a/photo-a.jpg", "trip-a/photo-c.jpg"}
    # Ensure trip-b data is excluded entirely
    assert all(item["metadata_id"].startswith("trip-a/") for item in results)
