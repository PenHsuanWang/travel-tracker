"""Achievement engine for awarding badges and updating user totals.

This module exposes an `AchievementEngine` singleton that listens for GPX
processing events and member changes to increment user totals (distance,
elevation, trips) and award achievement badges when thresholds are met.

The engine writes counters to the `users` collection via the project's
storage adapters and is intended to be used by the event bus.
"""

import logging
from typing import Dict, Any, List
from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager
from src.models.user import User

logger = logging.getLogger(__name__)


class AchievementEngine:
    """Engine that updates user statistics and awards badges.

    The engine maintains a small set of badge criteria and updates the
    MongoDB `users` collection via the storage adapter. It is safe to call
    its handler methods from the application's event handlers.
    """

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

    def _increment_user_totals(self, user_id: str, distance_km: float, elevation_gain_m: float, trip_increment: bool = True):
        """Increment stored totals for a user.

        This updates the user's `total_distance_km`, `total_elevation_gain_m`,
        and optionally `total_trips` counters in the `users` collection.

        Args:
            user_id (str): The user identifier (either MongoDB ObjectId string
                or application-level user id).
            distance_km (float): Distance in kilometers to add to the user's total.
            elevation_gain_m (float): Elevation gain in meters to add.
            trip_increment (bool): If True, increments the user's trip count by 1.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            return
        users_collection = adapter.get_collection(self.collection_name)

        from bson import ObjectId

        try:
            try:
                oid = ObjectId(user_id)
                query = {"_id": oid}
            except Exception:
                query = {"_id": user_id}

            inc_payload = {
                "total_distance_km": distance_km,
                "total_elevation_gain_m": elevation_gain_m,
            }
            if trip_increment:
                inc_payload["total_trips"] = 1

            update_result = users_collection.find_one_and_update(
                query,
                {"$inc": inc_payload},
                return_document=True
            )

            if update_result:
                self._check_and_award_badges(update_result, users_collection)
        except Exception as e:
            logger.error(f"Failed to update stats for user {user_id}: {e}")

    def handle_gpx_processed(self, payload: Dict[str, Any]):
        """Handle a GPX processed event, updating members' totals.

        Expected payload example::

            {
                "trip_id": "<trip id>",
                "stats": {"distance_km": 12.3, "elevation_gain_m": 250},
                "member_ids": ["user1", "user2"]
            }

        Args:
            payload (Dict[str, Any]): Event payload containing `stats` and
                `member_ids` used to update each member's totals.
        """
        trip_id = payload.get("trip_id")
        stats = payload.get("stats", {})
        member_ids = payload.get("member_ids", [])
        
        if not stats or not member_ids:
            return

        distance_km = stats.get("distance_km", 0)
        elevation_gain_m = stats.get("elevation_gain_m", 0)
        
        logger.info(f"Processing achievements for trip {trip_id} (Dist: {distance_km}km, Elev: {elevation_gain_m}m)")
        
        for user_id in member_ids:
            self._increment_user_totals(user_id, distance_km, elevation_gain_m, trip_increment=True)

    def handle_member_added(self, payload: Dict[str, Any]):
        """Handle a member-added event and grant trip credits.

        The payload structure is the same as for GPX processed events: it
        should contain `stats` and `member_ids`. Newly added members receive
        the trip's distance and elevation added to their totals.

        Args:
            payload (Dict[str, Any]): Event payload with `stats` and
                `member_ids`.
        """
        stats = payload.get("stats", {})
        member_ids = payload.get("member_ids", [])
        if not stats or not member_ids:
            return

        distance_km = stats.get("distance_km", 0)
        elevation_gain_m = stats.get("elevation_gain_m", 0)

        for user_id in member_ids:
            self._increment_user_totals(user_id, distance_km, elevation_gain_m, trip_increment=True)

    def _check_and_award_badges(self, user_doc: Dict[str, Any], collection):
        """Check badge criteria and persist any newly earned badges.

        Args:
            user_doc (Dict[str, Any]): The user document as read from the DB.
            collection: The MongoDB collection object to update.
        """
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
