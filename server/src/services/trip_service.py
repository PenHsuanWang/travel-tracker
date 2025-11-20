from typing import List, Optional, Dict, Any
from datetime import datetime
from src.models.trip import Trip
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
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

    def get_trips(self) -> List[Trip]:
        """
        Get all trips.
        """
        # This is a bit of a hack since StorageManager doesn't have a list_all method for MongoDB
        # We'll need to access the adapter directly or extend StorageManager.
        # For now, let's assume we can use the adapter directly if needed, 
        # but StorageManager has list_keys which might not be enough for full docs.
        # Let's use the adapter directly for querying.
        
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        # We need to access the underlying collection to find all
        # The adapter exposes 'find' method? Let's check MongoDBAdapter.
        # Assuming standard pymongo usage via adapter if it exposes the collection or a find method.
        # Looking at previous code, it seems we might need to extend the adapter or use what's available.
        # The MongoDBAdapter likely has a find method or similar.
        # Let's try to use list_keys to get IDs then load_batch, or better yet, 
        # if the adapter supports a query method.
        
        # Since I can't see MongoDBAdapter source right now, I'll assume I can iterate or find.
        # If StorageManager is strict, I might need to implement a 'find' or 'list_all' there.
        # Let's try to use the adapter's find method if it exists, or implement a simple listing.
        
        # HACK: Accessing internal db object of adapter if possible, or assuming adapter has `find`.
        # Let's assume we can get all documents.
        
        # Re-reading StorageManager: it has list_keys.
        # Let's use list_keys to get all IDs, then load_batch_data.
        # This is inefficient for large datasets but fine for MVP.
        
        keys = self.storage_manager.list_keys('mongodb', collection_name=self.collection_name)
        trips_data = self.storage_manager.load_batch_data('mongodb', keys, collection_name=self.collection_name)
        
        trips = []
        for key, data in trips_data.items():
            if data:
                trips.append(Trip(**data))
        
        # Sort by start_date descending
        trips.sort(key=lambda x: x.start_date or datetime.min, reverse=True)
        return trips

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

    def delete_trip(self, trip_id: str) -> bool:
        """
        Delete a trip.
        """
        # TODO: Cascade delete files associated with this trip?
        # For now, just delete the trip record.
        return self.storage_manager.delete_data(
            trip_id,
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
