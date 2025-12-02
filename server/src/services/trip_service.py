from typing import List, Optional, Dict, Any
from datetime import datetime
from src.models.trip import Trip, TripResponse
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from bson import ObjectId
import logging

class TripService:
    """
    Service to handle trip operations.
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
        """
        Create a new trip.
        """
        self.storage_manager.save_data(
            trip_data.id,
            trip_data.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
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
            # Filter where user_id is in member_ids
            query["member_ids"] = user_id
            
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

    def get_trip(self, trip_id: str) -> Optional[Trip]:
        """
        Get a specific trip by ID.
        """
        data = self.storage_manager.load_data(
            'mongodb',
            trip_id,
            collection_name=self.collection_name
        )
        if data:
            return Trip(**data)
        return None

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
            if key in trip_dict:
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
            
        return self.update_trip(trip_id, {"member_ids": member_ids})

    def delete_trip(self, trip_id: str) -> bool:
        """
        Delete a trip and cascade-delete associated files/metadata.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")

        minio_adapter = self.storage_manager.adapters.get('minio')
        deleted_objects = []
        errors = []

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
        return bool(trip_deleted)
