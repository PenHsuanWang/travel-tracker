"""Trip CRUD helpers and membership orchestration."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from src.events.event_bus import EventBus
from src.models.trip import Trip, TripResponse, TripStats
from src.services.service_dependencies import ensure_storage_manager
from src.services.user_stats_service import UserStatsService, user_stats_service
from src.utils.dbbutler.storage_manager import StorageManager

class TripService:
    """Service layer covering trip CRUD operations and stats updates."""

    def __init__(
        self,
        storage_manager: StorageManager,
        stats_service: UserStatsService,
        event_bus: type[EventBus] = EventBus,
    ) -> None:
        """Initializes the TripService with its dependencies.

        :param storage_manager: A configured StorageManager instance.
        :param stats_service: An instance of the UserStatsService.
        :param event_bus: The application's event bus class.
        """
        self.logger = logging.getLogger(__name__)
        self.storage_manager = storage_manager
        self.collection_name = 'trips'
        self.stats_service = stats_service
        self.event_bus = event_bus

    def create_trip(self, trip_data: Trip) -> Trip:
        """
        Create a new trip.
        """
        self.storage_manager.save_data(
            trip_data.id,
            trip_data.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
        self.stats_service.sync_multiple_users(trip_data.member_ids or [])
        return trip_data

    def get_trips(self, user_id: Optional[str] = None) -> List[TripResponse]:
        """
        Get all trips. Optionally filter by user_id (membership).
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        collection = adapter.get_collection(self.collection_name)
        
        query = {}
        if user_id:
            match_conditions = [{"member_ids": user_id}]
            try:
                match_conditions.append({"member_ids": ObjectId(user_id)})
            except Exception:
                pass
            query["$or"] = match_conditions
        
        cursor = collection.find(query)
        
        trips = []
        for data in cursor:
            trips.append(Trip(**data))
            
        # Sort by start_date descending
        trips.sort(key=lambda x: x.start_date or datetime.min, reverse=True)
        
        # Populate owner details
        owner_ids = list(set(t.owner_id for t in trips if t.owner_id))
        users_map = {}
        
        if owner_ids:
            users_collection = adapter.get_collection('users')
            owner_obj_ids = []
            for oid in owner_ids:
                try:
                    owner_obj_ids.append(ObjectId(oid))
                except:
                    pass
            
            if owner_obj_ids:
                users_cursor = users_collection.find({"_id": {"$in": owner_obj_ids}})
                for u in users_cursor:
                    uid = str(u["_id"])
                    users_map[uid] = {
                        "id": uid,
                        "username": u.get("username", "Unknown"),
                        "avatar_url": u.get("avatar_url")
                    }
        
        result = []
        for t in trips:
            tr = TripResponse(**t.model_dump())
            if t.owner_id and t.owner_id in users_map:
                tr.owner = users_map[t.owner_id]
            result.append(tr)
            
        return result

    def get_trip(self, trip_id: str) -> Optional[TripResponse]:
        """
        Get a specific trip by ID with owner and members populated.
        """
        data = self.storage_manager.load_data(
            'mongodb',
            trip_id,
            collection_name=self.collection_name
        )
        if not data:
            return None
            
        trip = Trip(**data)
        trip_response = TripResponse(**trip.model_dump())
        
        # Populate owner and members
        adapter = self.storage_manager.adapters.get('mongodb')
        if adapter:
            users_collection = adapter.get_collection('users')
            
            # Collect all user IDs (owner + members)
            user_ids_to_fetch = set()
            if trip.owner_id:
                user_ids_to_fetch.add(trip.owner_id)
            if trip.member_ids:
                user_ids_to_fetch.update(trip.member_ids)
                
            if user_ids_to_fetch:
                obj_ids = []
                for uid in user_ids_to_fetch:
                    try:
                        obj_ids.append(ObjectId(uid))
                    except:
                        pass
                
                if obj_ids:
                    users_cursor = users_collection.find({"_id": {"$in": obj_ids}})
                    users_map = {}
                    for u in users_cursor:
                        uid = str(u["_id"])
                        users_map[uid] = {
                            "id": uid,
                            "username": u.get("username", "Unknown"),
                            "avatar_url": u.get("avatar_url")
                        }
                        
                    if trip.owner_id and trip.owner_id in users_map:
                        trip_response.owner = users_map[trip.owner_id]
                        
                    if trip.member_ids:
                        trip_response.members = [
                            users_map[mid] for mid in trip.member_ids if mid in users_map
                        ]
                        
        return trip_response

    def update_trip(self, trip_id: str, update_data: Dict[str, Any]) -> Optional[Trip]:
        """
        Update a trip.
        """
        current_trip = self.get_trip(trip_id)
        if not current_trip:
            return None
            
        # Update fields
        trip_dict = current_trip.model_dump()
        for key, value in update_data.items():
            if key not in trip_dict:
                continue
            if key == "stats" and isinstance(value, dict):
                trip_dict[key] = TripStats(**{**trip_dict.get("stats", {}), **value}).model_dump()
            else:
                trip_dict[key] = value
        
        updated_trip = Trip(**trip_dict)
        
        self.storage_manager.save_data(
            trip_id,
            updated_trip.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
        return updated_trip

    def update_members(self, trip_id: str, member_ids: List[str], current_user_id: str) -> Optional[Trip]:
        """
        Update trip members. Only owner can do this.
        """
        trip = self.get_trip(trip_id)
        if not trip:
            return None
        
        if trip.owner_id != current_user_id:
            # We'll let the controller handle the exception or return None/False
            raise PermissionError("Only the owner can manage members.")
            
        # Ensure owner is always a member
        if trip.owner_id not in member_ids:
            member_ids.append(trip.owner_id)

        existing_members = set(trip.member_ids or [])
        new_members = [mid for mid in member_ids if mid not in existing_members]
        updated = self.update_trip(trip_id, {"member_ids": member_ids})

        if updated:
            affected_users = set(existing_members) | set(member_ids)
            if trip.owner_id:
                affected_users.add(trip.owner_id)
            self.stats_service.sync_multiple_users(affected_users)

        if updated and new_members and getattr(trip, "stats", None):
            self.event_bus.publish("MEMBER_ADDED", {
                "trip_id": trip_id,
                "member_ids": new_members,
                "stats": trip.stats.model_dump() if hasattr(trip, "stats") else {}
            })

        return updated

    def update_trip_stats(self, trip_id: str, stats: Dict[str, Any]) -> Optional[Trip]:
        """Persist denormalized trip statistics."""
        trip = self.get_trip(trip_id)
        if not trip:
            return None

        existing_stats = trip.stats.model_dump() if getattr(trip, "stats", None) else TripStats().model_dump()
        updated_stats = {
            **existing_stats,
            "distance_km": float(stats.get("distance_km", existing_stats.get("distance_km", 0.0)) or 0.0),
            "elevation_gain_m": float(stats.get("elevation_gain_m", existing_stats.get("elevation_gain_m", 0.0)) or 0.0),
            "moving_time_sec": float(stats.get("moving_time_sec", existing_stats.get("moving_time_sec", 0.0)) or 0.0),
            "max_altitude_m": float(stats.get("max_altitude_m", existing_stats.get("max_altitude_m", 0.0)) or 0.0),
        }

        updated_trip = self.update_trip(trip_id, {"stats": updated_stats})
        if updated_trip:
            self.stats_service.sync_multiple_users(updated_trip.member_ids or [])
        return updated_trip

    def delete_trip(self, trip_id: str) -> bool:
        """
        Delete a trip and cascade-delete associated files/metadata.
        """
        existing_trip = self.get_trip(trip_id)
        if not existing_trip:
            return False

        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")

        minio_adapter = self.storage_manager.adapters.get('minio')
        deleted_objects = []
        errors = []
        affected_users = set(existing_trip.member_ids or [])
        if existing_trip.owner_id:
            affected_users.add(existing_trip.owner_id)

        metadata_collection = None
        # Collect all file metadata for the trip so we can clean both metadata and storage.
        try:
            metadata_collection = adapter.get_collection('file_metadata')
            metadata_docs = list(metadata_collection.find({"trip_id": trip_id}))
        except Exception as exc:
            metadata_docs = []
            metadata_collection = None
            errors.append(f"Failed to enumerate file metadata for trip {trip_id}: {exc}")

        # Delete storage objects first (original + analyzed artifacts)
        if minio_adapter and metadata_docs:
            for doc in metadata_docs:
                object_key = doc.get("object_key")
                bucket = doc.get("bucket")
                if object_key and bucket:
                    try:
                        minio_adapter.delete_data(object_key, bucket=bucket)
                        deleted_objects.append(f"{bucket}/{object_key}")
                    except Exception as exc:
                        errors.append(f"Failed to delete {bucket}/{object_key}: {exc}")
                analysis_key = doc.get("analysis_object_key")
                analysis_bucket = doc.get("analysis_bucket")
                if analysis_key and analysis_bucket:
                    try:
                        minio_adapter.delete_data(analysis_key, bucket=analysis_bucket)
                        deleted_objects.append(f"{analysis_bucket}/{analysis_key}")
                    except Exception as exc:
                        errors.append(f"Failed to delete {analysis_bucket}/{analysis_key}: {exc}")

        # Remove metadata documents for the trip
        if metadata_collection is not None:
            try:
                metadata_collection.delete_many({"trip_id": trip_id})
            except Exception as exc:
                errors.append(f"Failed to delete metadata for trip {trip_id}: {exc}")

        # Delete the trip record itself
        trip_deleted = self.storage_manager.delete_data(
            trip_id,
            adapter_name='mongodb',
            collection_name=self.collection_name
        )

        if errors:
            logging.getLogger(__name__).warning(
                "Trip %s deletion completed with warnings. deleted=%s errors=%s",
                trip_id,
                len(deleted_objects),
                errors,
            )
        if trip_deleted:
            self.stats_service.sync_multiple_users(affected_users)
        return bool(trip_deleted)
