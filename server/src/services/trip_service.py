from typing import List, Optional, Dict, Any
from datetime import datetime
from src.models.trip import Trip, TripResponse, TripStats
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.events.event_bus import EventBus
from src.services.user_stats_service import user_stats_service
from bson import ObjectId
import logging

class TripService:
    """Service for managing Trip lifecycle and denormalized stats.

    Responsibilities include creating, updating and deleting trips, updating
    trip statistics, and notifying downstream systems (via EventBus) when
    membership or GPX processing events occur.
    """
    
    def __init__(self):
        self.storage_manager = StorageManager()
        # Initialize MongoDB adapter
        mongodb_adapter = AdapterFactory.create_mongodb_adapter()
        self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        try:
            minio_adapter = AdapterFactory.create_minio_adapter()
            self.storage_manager.add_adapter('minio', minio_adapter)
        except Exception as exc:
            logging.getLogger(__name__).warning("MinIO adapter not initialized for TripService: %s", exc)
        self.collection_name = 'trips'

    def create_trip(self, trip_data: Trip) -> Trip:
        """Persist a new trip document.

        Args:
            trip_data (Trip): Trip model to persist.

        Returns:
            Trip: The persisted trip model.
        """
        self.storage_manager.save_data(
            trip_data.id,
            trip_data.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
        user_stats_service.sync_multiple_users(trip_data.member_ids or [])
        return trip_data

    def get_trips(self, user_id: Optional[str] = None) -> List[TripResponse]:
        """Retrieve trips, optionally filtering by membership.

        Args:
            user_id (Optional[str]): If provided, only trips where the user is
                a member will be returned.

        Returns:
            List[TripResponse]: List of trip responses with owner info populated.
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
        """Load a single trip by id and populate owner/members summaries.

        Args:
            trip_id (str): Trip identifier.

        Returns:
            Optional[TripResponse]: TripResponse or ``None`` if not found.
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
        """Update a trip document with allowed fields.

        Args:
            trip_id: Trip identifier.
            update_data: Mapping of fields to update.

        Returns:
            Updated trip model or ``None`` if not found.
        """
        raw_data = self.storage_manager.load_data(
            'mongodb',
            trip_id,
            collection_name=self.collection_name
        )
        if not raw_data:
            return None

        current_trip = Trip(**raw_data)
            
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
        """Update trip membership list (owner-only operation).

        This method performs a direct database update to set the `member_ids`
        field, ensuring atomicity and preventing data corruption from complex
        model parsing cycles. It also ensures the owner remains a member.

        Args:
            trip_id: Trip identifier.
            member_ids: The complete new list of member ids.
            current_user_id: ID of the user performing the update.

        Returns:
            The updated trip DTO, or ``None`` if the trip was not found.
        
        Raises:
            PermissionError: If the `current_user_id` is not the trip owner.
        """
        # 1. Load raw data for permission check
        raw_data = self.storage_manager.load_data('mongodb', trip_id, collection_name=self.collection_name)
        if not raw_data:
            return None
        trip = Trip(**raw_data)

        # 2. Perform permission check
        if trip.owner_id != current_user_id:
            raise PermissionError("Only the owner can manage members.")
            
        # 3. Ensure owner is always a member and remove duplicates
        new_member_set = set(member_ids)
        if trip.owner_id:
            new_member_set.add(trip.owner_id)
        
        final_member_ids = list(new_member_set)
        existing_members = set(trip.member_ids or [])

        # 4. Perform a direct, surgical update using the adapter
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
        
        collection = adapter.get_collection(self.collection_name)
        result = collection.update_one(
            {"_id": trip_id},
            {"$set": {"member_ids": final_member_ids}}
        )

        if result.matched_count == 0:
            return None

        # 5. Sync user stats for all affected users (old and new)
        affected_users = existing_members.union(final_member_ids)
        if affected_users:
            user_stats_service.sync_multiple_users(list(affected_users))

        # 6. Fire event for newly added members
        newly_added_members = [mid for mid in final_member_ids if mid not in existing_members]
        if newly_added_members and getattr(trip, "stats", None):
            EventBus.publish("MEMBER_ADDED", {
                "trip_id": trip_id,
                "member_ids": newly_added_members,
                "stats": trip.stats.model_dump() if hasattr(trip, "stats") else {}
            })

        # 7. Return the fully updated trip by calling get_trip
        return self.get_trip(trip_id)

    def update_trip_stats(self, trip_id: str, stats: Dict[str, Any]) -> Optional[Trip]:
        """Persist denormalized trip statistics.

        Args:
            trip_id (str): Trip identifier.
            stats (Dict[str, Any]): Stats mapping (distance_km, elevation_gain_m, etc.).

        Returns:
            Optional[Trip]: Updated trip model or ``None`` if not found.
        """
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
            user_stats_service.sync_multiple_users(updated_trip.member_ids or [])
        return updated_trip

    def delete_trip(self, trip_id: str) -> bool:
        """Delete a trip and cascade-delete associated files and metadata.

        This will attempt to remove related objects from object storage and
        delete metadata documents. It returns ``True`` when the trip record
        was deleted from MongoDB. Warnings during deletion are logged.

        Args:
            trip_id (str): Trip identifier to delete.

        Returns:
            bool: ``True`` if the trip record was deleted, ``False`` otherwise.
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
            user_stats_service.sync_multiple_users(affected_users)
        return bool(trip_deleted)
