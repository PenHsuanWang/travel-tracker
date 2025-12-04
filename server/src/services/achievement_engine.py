"""Gamification engine that awards badges based on trip stats."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from src.dependencies import get_storage_manager
from src.utils.dbbutler.storage_manager import StorageManager

logger = logging.getLogger(__name__)

class AchievementEngine:
    def __init__(self, storage_manager: StorageManager) -> None:
        self.storage_manager = storage_manager
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
        
        for user_id in member_ids:
            self._increment_user_totals(user_id, distance_km, elevation_gain_m, trip_increment=True)

    def handle_member_added(self, payload: Dict[str, Any]):
        """Grant trip credit to newly added members."""
        stats = payload.get("stats", {})
        member_ids = payload.get("member_ids", [])
        if not stats or not member_ids:
            return

        distance_km = stats.get("distance_km", 0)
        elevation_gain_m = stats.get("elevation_gain_m", 0)

        for user_id in member_ids:
            self._increment_user_totals(user_id, distance_km, elevation_gain_m, trip_increment=True)

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
achievement_engine = AchievementEngine(storage_manager=get_storage_manager())
