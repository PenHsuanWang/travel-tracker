import pytest
from pydantic import ValidationError
from src.models.trip import Trip, TripStats
from src.models.user import UserCreate, User
from src.models.file_metadata import FileMetadata

def test_trip_requires_name():
    with pytest.raises(ValidationError, match="name\n  Field required"):
        Trip()

def test_trip_stats_defaults():
    stats = TripStats()
    assert stats.distance_km == 0.0
    assert stats.elevation_gain_m == 0.0

def test_user_create_requires_fields():
    # Missing password
    with pytest.raises(ValidationError):
        UserCreate(username="test", email="test@test.com", registration_key="key")
    # Missing registration key
    with pytest.raises(ValidationError):
        UserCreate(username="test", email="test@test.com", password="password")

def test_user_email_validation():
    with pytest.raises(ValidationError, match="value is not a valid email address"):
        User(username="test", email="not-an-email")

def test_file_metadata_id_alias():
    # MongoDB uses _id, but Pydantic model uses id. Test alias.
    doc = {
        "_id": "object123",
        "object_key": "key",
        "bucket": "bucket",
        "filename": "file",
        "original_filename": "orig_file",
        "size": 100,
        "mime_type": "text/plain",
        "file_extension": "txt"
    }
    meta = FileMetadata(**doc)
    assert meta.id == "object123"
    
    # Test serialization back with alias
    dumped = meta.model_dump(by_alias=True)
    assert dumped["_id"] == "object123"
    assert "id" not in dumped
