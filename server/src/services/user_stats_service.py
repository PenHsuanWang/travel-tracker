"""Services for computing and syncing per-user activity statistics.

This module exposes `UserStatsService` which aggregates trip records to
compute cumulative statistics (distance, elevation, trips) and syncs them
back to the `users` collection in MongoDB.
"""

from __future__ import annotations

from typing import Dict, Iterable, Optional

from bson import ObjectId

from src.utils.adapter_factory import AdapterFactory


DEFAULT_STATS = {
    "total_distance_km": 0.0,
    "total_elevation_gain_m": 0.0,
    "total_trips": 0,
}


class UserStatsService:
    """Calculates and syncs user activity statistics based on trip data.

    Typical usage:
        stats = user_stats_service.calculate_stats(user_id)
        user_stats_service.sync_user_stats(user_id)
    """

    def __init__(self) -> None:
        self._mongo = AdapterFactory.create_mongodb_adapter()
        self._trips = self._mongo.get_collection("trips")
        self._users = self._mongo.get_collection("users")

    def _user_query(self, user_id: str) -> Dict[str, ObjectId | str]:
        """Build a MongoDB query for a user id.

        Accepts either a string ObjectId or an application-level identifier
        and returns a query dict safe to pass to collection methods.

        Args:
            user_id (str): The user identifier.

        Returns:
            Dict[str, ObjectId | str]: Query dict for `_id`.
        """
        if not user_id:
            return {"_id": None}
        try:
            return {"_id": ObjectId(user_id)}
        except Exception:
            return {"_id": user_id}

    def calculate_stats(self, user_id: Optional[str]) -> Dict[str, float | int]:
        """Aggregate trip records to compute user statistics.

        Args:
            user_id (Optional[str]): User id to calculate stats for. If
                falsy, returns the `DEFAULT_STATS` template.

        Returns:
            Dict[str, float|int]: Calculated totals for distance, elevation,
                and trip count.
        """
        if not user_id:
            return DEFAULT_STATS.copy()

        match_conditions = [{"member_ids": user_id}]
        try:
            match_conditions.append({"member_ids": ObjectId(user_id)})
        except Exception:
            pass

        pipeline = [
            {"$match": {"$or": match_conditions}},
            {
                "$group": {
                    "_id": None,
                    "total_distance_km": {
                        "$sum": {"$ifNull": ["$stats.distance_km", 0.0]}
                    },
                    "total_elevation_gain_m": {
                        "$sum": {"$ifNull": ["$stats.elevation_gain_m", 0.0]}
                    },
                    "total_trips": {"$sum": 1},
                }
            },
        ]

        result = list(self._trips.aggregate(pipeline))
        if not result:
            return DEFAULT_STATS.copy()

        stats = result[0]
        return {
            "total_distance_km": float(stats.get("total_distance_km", 0.0)),
            "total_elevation_gain_m": float(stats.get("total_elevation_gain_m", 0.0)),
            "total_trips": int(stats.get("total_trips", 0)),
        }

    def sync_user_stats(self, user_id: Optional[str]) -> Dict[str, float | int]:
        """Calculate and persist stats for a single user.

        Args:
            user_id (Optional[str]): The user id whose stats will be synced.

        Returns:
            Dict[str, float|int]: The computed stats.
        """
        stats = self.calculate_stats(user_id)
        if not user_id:
            return stats

        query = self._user_query(user_id)
        self._users.update_one(query, {"$set": stats})
        return stats

    def sync_multiple_users(self, user_ids: Iterable[Optional[str]]):
        """Sync stats for multiple users, deduplicating input.

        Args:
            user_ids (Iterable[Optional[str]]): Iterable of user ids to sync.
        """
        seen = set()
        for user_id in user_ids:
            if not user_id or user_id in seen:
                continue
            seen.add(user_id)
            self.sync_user_stats(user_id)


user_stats_service = UserStatsService()
