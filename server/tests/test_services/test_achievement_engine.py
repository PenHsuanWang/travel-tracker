import pytest
from bson import ObjectId
from src.services.achievement_engine import AchievementEngine

class TestAchievementEngine:

    @pytest.fixture
    def engine(self, mock_mongodb_adapter):
        return AchievementEngine()

    def test_increment_user_totals(self, engine, mock_mongodb_adapter):
        user_id = str(ObjectId())
        user_doc = {
            "_id": ObjectId(user_id), 
            "username": "test",
            "total_distance_km": 0,
            "total_elevation_gain_m": 0,
            "total_trips": 0
        }
        mock_mongodb_adapter.save_data(user_id, user_doc, collection_name='users')
        
        engine._increment_user_totals(user_id, 10.0, 100.0)
        
        updated = mock_mongodb_adapter.load_data(user_id, collection_name='users')
        assert updated['total_distance_km'] == 10.0
        assert updated['total_elevation_gain_m'] == 100.0
        assert updated['total_trips'] == 1

    def test_check_and_award_badges_exact_threshold(self, engine, mock_mongodb_adapter):
        user_id = str(ObjectId())
        # Threshold for hiker-level-1 is 10.0 km
        user_doc = {
            "_id": ObjectId(user_id), 
            "username": "test",
            "total_distance_km": 10.0,
            "earned_badges": []
        }
        mock_mongodb_adapter.save_data(user_id, user_doc, collection_name='users')
        
        # We need to call _check_and_award_badges directly or via increment
        # Since _increment calls it, let's use that but with 0 increment to trigger check
        # Or just call private method for unit testing logic
        
        collection = mock_mongodb_adapter.get_collection('users')
        engine._check_and_award_badges(user_doc, collection)
        
        updated = mock_mongodb_adapter.load_data(user_id, collection_name='users')
        assert "hiker-level-1" in updated['earned_badges']

    def test_check_and_award_badges_below_threshold(self, engine, mock_mongodb_adapter):
        user_id = str(ObjectId())
        user_doc = {
            "_id": ObjectId(user_id), 
            "username": "test",
            "total_distance_km": 9.9,
            "earned_badges": []
        }
        mock_mongodb_adapter.save_data(user_id, user_doc, collection_name='users')
        
        collection = mock_mongodb_adapter.get_collection('users')
        engine._check_and_award_badges(user_doc, collection)
        
        updated = mock_mongodb_adapter.load_data(user_id, collection_name='users')
        assert "hiker-level-1" not in updated['earned_badges']

    def test_handle_gpx_processed(self, engine, mock_mongodb_adapter):
        user_id = str(ObjectId())
        user_doc = {"_id": ObjectId(user_id), "username": "test", "total_distance_km": 0, "total_trips": 0, "total_elevation_gain_m": 0}
        mock_mongodb_adapter.save_data(user_id, user_doc, collection_name='users')
        
        payload = {
            "trip_id": "trip1",
            "stats": {"distance_km": 20.0, "elevation_gain_m": 500},
            "member_ids": [user_id]
        }
        
        engine.handle_gpx_processed(payload)
        
        updated = mock_mongodb_adapter.load_data(user_id, collection_name='users')
        assert updated['total_distance_km'] == 20.0
        assert updated['total_trips'] == 1
        # Should have earned badge
        assert "hiker-level-1" in updated['earned_badges']

    def test_handle_member_added(self, engine, mock_mongodb_adapter):
        user_id = str(ObjectId())
        user_doc = {
            "_id": ObjectId(user_id), 
            "username": "new_member",
            "total_distance_km": 0,
            "total_elevation_gain_m": 0,
            "total_trips": 0
        }
        mock_mongodb_adapter.save_data(user_id, user_doc, collection_name='users')
        
        payload = {
            "trip_id": "trip1",
            "stats": {"distance_km": 15.0, "elevation_gain_m": 200},
            "member_ids": [user_id] # This event is for newly added members
        }
        
        engine.handle_member_added(payload)
        
        updated = mock_mongodb_adapter.load_data(user_id, collection_name='users')
        assert updated['total_distance_km'] == 15.0
        assert updated['total_elevation_gain_m'] == 200.0
        assert updated['total_trips'] == 1
        assert "hiker-level-1" in updated['earned_badges']
