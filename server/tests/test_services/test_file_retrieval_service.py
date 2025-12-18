import datetime
import pytest
from src.services.file_retrieval_service import FileRetrievalService
from src.utils import adapter_factory
from unittest.mock import MagicMock

# Existing fake classes from the file
class FakeMinioAdapter:
    def __init__(self, objects=None):
        self._objects = objects or {} # object_key -> data

    def list_keys(self, prefix: str = "", **kwargs):
        return [key for key in self._objects.keys() if key.startswith(prefix)]

    def exists(self, key: str, **kwargs):
        return key in self._objects

    def load_data(self, key: str, **kwargs):
        return self._objects.get(key)


class FakeCollection:
    def __init__(self, documents):
        self._documents = documents

    def find(self, query):
        # More sophisticated mock to handle geo queries and trip_id
        results = list(self._documents)
        
        if "bucket" in query:
            results = [doc for doc in results if doc.get("bucket") == query["bucket"]]
        if "trip_id" in query:
            results = [doc for doc in results if doc.get("trip_id") == query["trip_id"]]
        
        if "gps.latitude" in query and "$gte" in query["gps.latitude"]:
            min_lat = query["gps.latitude"]["$gte"]
            results = [doc for doc in results if doc.get("gps", {}).get("latitude", -999) >= min_lat]
        if "gps.latitude" in query and "$lte" in query["gps.latitude"]:
            max_lat = query["gps.latitude"]["$lte"]
            results = [doc for doc in results if doc.get("gps", {}).get("latitude", 999) <= max_lat]
            
        if "gps.longitude" in query and "$gte" in query["gps.longitude"]:
            min_lon = query["gps.longitude"]["$gte"]
            results = [doc for doc in results if doc.get("gps", {}).get("longitude", -999) >= min_lon]
        if "gps.longitude" in query and "$lte" in query["gps.longitude"]:
            max_lon = query["gps.longitude"]["$lte"]
            results = [doc for doc in results if doc.get("gps", {}).get("longitude", 999) <= max_lon]
            
        return results


class FakeMongoAdapter:
    def __init__(self, documents):
        self._collection = FakeCollection(documents)

    def get_collection(self, name: str):
        return self._collection

# Fixture for the service
@pytest.fixture
def retrieval_service(monkeypatch):
    # Default to empty adapters, tests will patch them
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_minio_adapter", lambda: FakeMinioAdapter())
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: FakeMongoAdapter([]))
    return FileRetrievalService()

# Existing fixture
@pytest.fixture
def metadata_document():
    return {
        "_id": "image-with-metadata.jpg", "object_key": "image-with-metadata.jpg", "bucket": "images",
        "filename": "image-with-metadata.jpg", "original_filename": "vacation.jpg", "size": 2048,
        "mime_type": "image/jpeg", "file_extension": "jpg", "exif": {},
        "gps": { "latitude": 10.0, "longitude": 20.0 },
        "date_taken": "2024-01-02", "camera_make": "Canon", "camera_model": "5D",
        "created_at": datetime.datetime(2024, 1, 3, 12, 0, 0), "uploader_id": "test-user", "status": "active",
    }

# Existing tests
def test_list_files_with_metadata_merges_storage_and_metadata(monkeypatch, metadata_document):
    fake_minio = FakeMinioAdapter({"image-with-metadata.jpg": b'', "orphan-image.jpg": b''})
    fake_mongo = FakeMongoAdapter([metadata_document])

    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_minio_adapter", lambda: fake_minio)
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: fake_mongo)

    service = FileRetrievalService()
    results = service.list_files_with_metadata("images")

    assert len(results) == 2
    result_index = {item["object_key"]: item for item in results}

    metadata_item = result_index["image-with-metadata.jpg"]
    assert metadata_item["has_metadata"] is True
    assert not metadata_item["warnings"]
    
    orphan_item = result_index["orphan-image.jpg"]
    assert orphan_item["has_metadata"] is False
    assert orphan_item["warnings"] == ["metadata_missing"]

def test_list_files_with_metadata_filters_by_trip(monkeypatch):
    fake_minio = FakeMinioAdapter({"trip-a/photo-a.jpg":b"", "trip-b/photo-b.jpg":b"", "trip-a/photo-c.jpg":b""})
    trip_a_doc = { "_id": "trip-a/photo-a.jpg", "object_key": "trip-a/photo-a.jpg", "bucket": "images", "trip_id": "trip-a", "created_at": datetime.datetime.now() }
    trip_b_doc = { "_id": "trip-b/photo-b.jpg", "object_key": "trip-b/photo-b.jpg", "bucket": "images", "trip_id": "trip-b", "created_at": datetime.datetime.now() }
    fake_mongo = FakeMongoAdapter([trip_a_doc, trip_b_doc])

    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_minio_adapter", lambda: fake_minio)
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: fake_mongo)

    service = FileRetrievalService()
    results = service.list_files_with_metadata("images", trip_id="trip-a")

    assert {item["object_key"] for item in results} == {"trip-a/photo-a.jpg", "trip-a/photo-c.jpg"}

# --- New Tests ---

def test_get_file_bytes(retrieval_service, monkeypatch):
    fake_minio = FakeMinioAdapter({"exists.txt": b"file content"})
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_minio_adapter", lambda: fake_minio)
    
    service = FileRetrievalService()
    
    # Test found
    content = service.get_file_bytes("my-bucket", "exists.txt")
    assert content == b"file content"
    
    # Test not found
    content_missing = service.get_file_bytes("my-bucket", "missing.txt")
    assert content_missing is None

def test_list_geotagged_images_no_filter(retrieval_service, monkeypatch, metadata_document):
    # Image inside bbox
    doc1 = metadata_document
    # Image outside bbox
    doc2 = doc1.copy()
    doc2["_id"] = "image2.jpg"
    doc2["object_key"] = "image2.jpg"
    doc2["gps"] = {"latitude": 50.0, "longitude": 50.0}
    # Image with no GPS
    doc3 = doc1.copy()
    doc3["_id"] = "image3.jpg"
    doc3["object_key"] = "image3.jpg"
    doc3["gps"] = None

    fake_mongo = FakeMongoAdapter([doc1, doc2, doc3])
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: fake_mongo)
    
    service = FileRetrievalService()
    results = service.list_geotagged_images(bucket_name="images")
    
    assert len(results) == 2 # doc3 is filtered out
    assert {r['object_key'] for r in results} == {"image-with-metadata.jpg", "image2.jpg"}

def test_list_geotagged_images_with_bbox_filter(retrieval_service, monkeypatch, metadata_document):
    # Image inside bbox
    doc1 = metadata_document # lat: 10, lon: 20
    # Image outside bbox
    doc2 = doc1.copy()
    doc2["_id"] = "image2.jpg"
    doc2["object_key"] = "image2.jpg"
    doc2["gps"] = {"latitude": 50.0, "longitude": 50.0}

    fake_mongo = FakeMongoAdapter([doc1, doc2])
    monkeypatch.setattr(adapter_factory.AdapterFactory, "create_mongodb_adapter", lambda: fake_mongo)

    service = FileRetrievalService()
    
    # Define a bbox that includes doc1 but not doc2
    bbox = {'minLon': 0, 'minLat': 0, 'maxLon': 30, 'maxLat': 30}
    results = service.list_geotagged_images(bucket_name="images", bbox=bbox)
    
    assert len(results) == 1
    assert results[0]['object_key'] == "image-with-metadata.jpg"
    assert results[0]['lat'] == 10.0
    assert results[0]['thumb_url'].startswith("/api/files/image-with-metadata.jpg")
