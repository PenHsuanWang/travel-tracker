import pytest
from bson import ObjectId
from src.services.user_stats_service import UserStatsService
from src.models.trip import Trip, TripStats

class TestUserStatsService:

    @pytest.fixture
    def stats_service(self, mock_mongodb_adapter):
        return UserStatsService()

    def test_calculate_stats_empty(self, stats_service):
        stats = stats_service.calculate_stats("user1")
        assert stats['total_distance_km'] == 0
        assert stats['total_elevation_gain_m'] == 0
        assert stats['total_trips'] == 0

    def test_calculate_stats_with_trips(self, stats_service, mock_mongodb_adapter):
        user_id = str(ObjectId())
        
        trip1 = Trip(
            name="Trip 1", 
            member_ids=[user_id],
            stats=TripStats(distance_km=10, elevation_gain_m=100)
        )
        trip2 = Trip(
            name="Trip 2", 
            member_ids=[user_id],
            stats=TripStats(distance_km=5, elevation_gain_m=50)
        )
        
        mock_mongodb_adapter.save_data(trip1.id, trip1.model_dump(by_alias=True), collection_name='trips')
        mock_mongodb_adapter.save_data(trip2.id, trip2.model_dump(by_alias=True), collection_name='trips')
        
        stats = stats_service.calculate_stats(user_id)
        
        assert stats['total_distance_km'] == 15
        assert stats['total_elevation_gain_m'] == 150
        assert stats['total_trips'] == 2

    def test_sync_user_stats(self, stats_service, mock_mongodb_adapter):
        user_id = str(ObjectId())
        user_doc = {"_id": ObjectId(user_id), "username": "test"}
        mock_mongodb_adapter.save_data(user_id, user_doc, collection_name='users')
        
        # Add a trip
        trip = Trip(
            name="Trip 1", 
            member_ids=[user_id],
            stats=TripStats(distance_km=10, elevation_gain_m=100)
        )
        mock_mongodb_adapter.save_data(trip.id, trip.model_dump(by_alias=True), collection_name='trips')
        
        stats_service.sync_user_stats(user_id)
        
        updated_user = mock_mongodb_adapter.load_data(user_id, collection_name='users')
        assert updated_user['total_distance_km'] == 10
        assert updated_user['total_trips'] == 1

