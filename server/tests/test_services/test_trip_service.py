import pytest
from datetime import datetime
from bson import ObjectId
from src.services.trip_service import TripService
from src.models.trip import Trip, TripStats
from src.models.user import User

class TestTripService:
    
    @pytest.fixture
    def trip_service(self, mock_mongodb_adapter, mock_minio_adapter):
        return TripService()

    def test_create_trip(self, trip_service, mock_mongodb_adapter, mock_event_bus):
        trip = Trip(
            name="Test Trip",
            start_date=datetime(2023, 1, 1),
            end_date=datetime(2023, 1, 5),
            owner_id="user1"
        )
        
        result = trip_service.create_trip(trip)
        
        assert result.id is not None
        assert result.name == "Test Trip"
        
        # Verify persistence
        saved_trip = mock_mongodb_adapter.load_data(result.id, collection_name='trips')
        assert saved_trip is not None
        assert saved_trip['name'] == "Test Trip"
        assert saved_trip['owner_id'] == "user1"

    def test_get_trips_no_filter(self, trip_service, mock_mongodb_adapter):
        # Setup data
        trip1 = Trip(name="Trip A", start_date=datetime(2023, 1, 1))
        trip2 = Trip(name="Trip B", start_date=datetime(2023, 2, 1))
        
        mock_mongodb_adapter.save_data(trip1.id, trip1.model_dump(by_alias=True), collection_name='trips')
        mock_mongodb_adapter.save_data(trip2.id, trip2.model_dump(by_alias=True), collection_name='trips')
        
        results = trip_service.get_trips()
        
        assert len(results) == 2
        # Should be sorted by start_date desc
        assert results[0].name == "Trip B"
        assert results[1].name == "Trip A"

    def test_get_trips_with_user_filter(self, trip_service, mock_mongodb_adapter):
        user_id = str(ObjectId())
        trip1 = Trip(name="My Trip", member_ids=[user_id])
        trip2 = Trip(name="Other Trip", member_ids=["other_user"])
        
        mock_mongodb_adapter.save_data(trip1.id, trip1.model_dump(by_alias=True), collection_name='trips')
        mock_mongodb_adapter.save_data(trip2.id, trip2.model_dump(by_alias=True), collection_name='trips')
        
        results = trip_service.get_trips(user_id=user_id)
        
        assert len(results) == 1
        assert results[0].name == "My Trip"

    def test_get_trips_populates_owner(self, trip_service, mock_mongodb_adapter):
        owner_id = str(ObjectId())
        trip = Trip(name="Owner Trip", owner_id=owner_id)
        
        user_doc = {
            "_id": ObjectId(owner_id),
            "username": "owner_user",
            "avatar_url": "http://example.com/avatar.jpg"
        }
        
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        mock_mongodb_adapter.save_data(owner_id, user_doc, collection_name='users')
        
        results = trip_service.get_trips()
        
        assert len(results) == 1
        assert results[0].owner is not None
        assert results[0].owner.username == "owner_user"
        assert results[0].owner.id == owner_id

    def test_get_trip(self, trip_service, mock_mongodb_adapter):
        trip = Trip(name="Single Trip")
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        result = trip_service.get_trip(trip.id)
        
        assert result is not None
        assert result.name == "Single Trip"
        
    def test_get_trip_nonexistent(self, trip_service):
        result = trip_service.get_trip("nonexistent")
        assert result is None

    def test_update_trip(self, trip_service, mock_mongodb_adapter):
        trip = Trip(name="Original Name")
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        update_data = {"name": "Updated Name"}
        result = trip_service.update_trip(trip.id, update_data)
        
        assert result is not None
        assert result.name == "Updated Name"
        
        saved = mock_mongodb_adapter.load_data(trip.id, collection_name='trips')
        assert saved['name'] == "Updated Name"

    def test_update_members(self, trip_service, mock_mongodb_adapter, mock_event_bus):
        owner_id = "owner1"
        trip = Trip(name="Member Trip", owner_id=owner_id, member_ids=[owner_id])
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        new_members = [owner_id, "new_user"]
        
        # Mock user existence check (update_members calls sync_multiple_users which might check users)
        # But strictly update_members logic in TripService mainly updates the trip doc.
        # It does call user_stats_service.sync_multiple_users.
        
        result = trip_service.update_members(trip.id, new_members, current_user_id=owner_id)
        
        assert result is not None
        assert "new_user" in result.member_ids
        assert owner_id in result.member_ids
        
        # Verify MEMBER_ADDED event
        assert len(mock_event_bus) > 0
        topic, payload = mock_event_bus[0]
        assert topic == "MEMBER_ADDED"
        assert payload['trip_id'] == trip.id
        assert "new_user" in payload['member_ids']

    def test_update_members_not_owner(self, trip_service, mock_mongodb_adapter):
        owner_id = "owner1"
        other_user = "other"
        trip = Trip(name="Member Trip", owner_id=owner_id, member_ids=[owner_id])
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        with pytest.raises(PermissionError):
            trip_service.update_members(trip.id, ["new_user"], current_user_id=other_user)

    def test_update_trip_stats(self, trip_service, mock_mongodb_adapter):
        trip = Trip(name="Stats Trip")
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        stats_update = TripStats(distance_km=10.5, elevation_gain_m=500)
        
        trip_service.update_trip_stats(trip.id, stats_update.model_dump())
        
        saved = mock_mongodb_adapter.load_data(trip.id, collection_name='trips')
        assert saved['stats']['distance_km'] == 10.5
        assert saved['stats']['elevation_gain_m'] == 500

    def test_delete_trip(self, trip_service, mock_mongodb_adapter, mock_minio_adapter):
        trip = Trip(name="Delete Trip")
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        # Add some associated files
        file_meta = {
            "_id": "file1",
            "trip_id": trip.id,
            "bucket": "images",
            "object_key": "img.jpg"
        }
        mock_mongodb_adapter.save_data("file1", file_meta, collection_name='file_metadata')
        mock_minio_adapter.save_data("img.jpg", b"data", bucket="images")
        
        result = trip_service.delete_trip(trip.id)
        
        assert result is True
        assert not mock_mongodb_adapter.exists(trip.id, collection_name='trips')
        assert not mock_mongodb_adapter.exists("file1", collection_name='file_metadata')
        assert not mock_minio_adapter.exists("img.jpg", bucket="images")

