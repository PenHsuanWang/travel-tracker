import logging
from typing import Dict, Any, List
from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager
from src.models.user import User

logger = logging.getLogger(__name__)

class AchievementEngine:
    def __init__(self):
        self.storage_manager = StorageManager()
        self.storage_manager.add_adapter('mongodb', AdapterFactory.create_mongodb_adapter())
        self.collection_name = 'users'
        
        # Define Badges
        self.badges = {
            "hiker-level-1": {"name": "Hiker Level 1", "threshold_km": 10.0},
            "hiker-level-2": {"name": "Hiker Level 2", "threshold_km": 50.0},
            "hiker-level-3": {"name": "Hiker Level 3", "threshold_km": 100.0},
            "climber-level-1": {"name": "Climber Level 1", "threshold_m": 500.0},
            "climber-level-2": {"name": "Climber Level 2", "threshold_m": 2000.0},
            "climber-level-3": {"name": "Climber Level 3", "threshold_m": 5000.0},
        }

    def handle_gpx_processed(self, payload: Dict[str, Any]):
        """
        Event handler for GPX_PROCESSED.
        Payload: {"trip_id": str, "stats": dict, "member_ids": List[str]}
        """
        trip_id = payload.get("trip_id")
        stats = payload.get("stats", {})
        member_ids = payload.get("member_ids", [])
        
        if not stats or not member_ids:
            return

        distance_km = stats.get("distance_km", 0)
        elevation_gain_m = stats.get("elevation_gain_m", 0)
        
        logger.info(f"Processing achievements for trip {trip_id} (Dist: {distance_km}km, Elev: {elevation_gain_m}m)")
        
        adapter = self.storage_manager.adapters.get('mongodb')
        users_collection = adapter.get_collection(self.collection_name)
        
        from bson import ObjectId
        
        for user_id in member_ids:
            try:
                # Update stats
                # We use $inc to be atomic
                # Also increment total_trips
                
                # First, get current user to check badges
                # Note: In a real system, we might want to do this in a transaction or use more complex logic
                # But for now, we'll fetch, check, and update.
                # Actually, we can use find_one_and_update to get the NEW document, then check badges?
                # Or just update stats first.
                
                # Convert string ID to ObjectId if needed
                try:
                    oid = ObjectId(user_id)
                    query = {"_id": oid}
                except:
                    query = {"_id": user_id} # Fallback if string IDs are used
                
                update_result = users_collection.find_one_and_update(
                    query,
                    {
                        "$inc": {
                            "total_distance_km": distance_km,
                            "total_elevation_gain_m": elevation_gain_m,
                            "total_trips": 1
                        }
                    },
                    return_document=True # Return the updated document
                )
                
                if update_result:
                    self._check_and_award_badges(update_result, users_collection)
                    
            except Exception as e:
                logger.error(f"Failed to update stats for user {user_id}: {e}")

    def _check_and_award_badges(self, user_doc: Dict[str, Any], collection):
        user_badges = set(user_doc.get("earned_badges", []))
        new_badges = []
        
        total_dist = user_doc.get("total_distance_km", 0)
        total_elev = user_doc.get("total_elevation_gain_m", 0)
        
        # Check Distance Badges
        for badge_id, criteria in self.badges.items():
            if badge_id in user_badges:
                continue
                
            if "threshold_km" in criteria and total_dist >= criteria["threshold_km"]:
                new_badges.append(badge_id)
            elif "threshold_m" in criteria and total_elev >= criteria["threshold_m"]:
                new_badges.append(badge_id)
                
        if new_badges:
            logger.info(f"User {user_doc.get('username')} earned badges: {new_badges}")
            collection.update_one(
                {"_id": user_doc["_id"]},
                {"$addToSet": {"earned_badges": {"$each": new_badges}}}
            )
            # TODO: Create notification

# Singleton instance
achievement_engine = AchievementEngine()
