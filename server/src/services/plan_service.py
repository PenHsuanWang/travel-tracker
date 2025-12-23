"""Service for managing Plan lifecycle and GeoJSON features.

This service follows the same patterns as TripService, using the
StorageManager with MongoDB adapter for persistence. It provides
CRUD operations for Plans, feature management, reference tracks,
and member management. Plan/Trip promotion is intentionally omitted
to keep the two entities fully decoupled.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging

from src.models.plan import (
    Plan, PlanResponse, PlanCreate, PlanUpdate,
    PlanFeature, PlanFeatureCollection, PlanFeatureProperties,
    ReferenceTrack, ReferenceTrackAdd,
    PlanStatus, GeoJSONGeometry
)
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.events.event_bus import EventBus

logger = logging.getLogger(__name__)


class PlanService:
    """Service for managing Plan lifecycle and GeoJSON features.
    
    Responsibilities include:
    - Creating, updating, and deleting plans
    - Managing plan features (markers, routes, areas)
    - Managing reference tracks
    - Member management
    
    This service follows the same adapter pattern as TripService.
    """
    
    def __init__(self):
        """Initialize PlanService with storage adapters."""
        self.storage_manager = StorageManager()
        # Initialize MongoDB adapter
        mongodb_adapter = AdapterFactory.create_mongodb_adapter()
        self.storage_manager.add_adapter('mongodb', mongodb_adapter)
        self.collection_name = 'plans'
        
    # -------------------------------------------------------------------------
    # Plan CRUD Operations
    # -------------------------------------------------------------------------
    
    def create_plan(self, plan_data: Plan) -> Plan:
        """Persist a new plan document.
        
        Args:
            plan_data: Plan model to persist.
            
        Returns:
            The persisted plan model.
        """
        # Ensure created_at is set
        if not plan_data.created_at:
            plan_data.created_at = datetime.utcnow()
            
        self.storage_manager.save_data(
            plan_data.id,
            plan_data.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
        
        logger.info(f"Created plan: {plan_data.id} - {plan_data.name}")
        
        # Publish event for analytics/gamification
        EventBus.publish("PLAN_CREATED", {
            "plan_id": plan_data.id,
            "owner_id": plan_data.owner_id,
            "name": plan_data.name
        })
        
        return plan_data
    
    def get_plans(self, user_id: Optional[str] = None, status: Optional[str] = None) -> List[PlanResponse]:
        """Retrieve plans, optionally filtering by membership or status.
        
        Args:
            user_id: If provided, only plans where the user is a member.
            status: If provided, filter by plan status.
            
        Returns:
            List of plan responses with owner info populated.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        collection = adapter.get_collection(self.collection_name)
        
        query: Dict[str, Any] = {}
        
        # Filter by membership
        if user_id:
            match_conditions = [{"member_ids": user_id}]
            try:
                match_conditions.append({"member_ids": ObjectId(user_id)})
            except Exception:
                pass
            query["$or"] = match_conditions
            
        # Filter by status
        if status:
            query["status"] = status
            
        cursor = collection.find(query)
        
        plans = []
        for data in cursor:
            plans.append(Plan(**data))
            
        # Sort by created_at descending (newest first)
        plans.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
        
        # Populate owner details
        owner_ids = list(set(p.owner_id for p in plans if p.owner_id))
        users_map = self._fetch_users_map(adapter, owner_ids)
        
        result = []
        for p in plans:
            pr = PlanResponse(**p.model_dump())
            if p.owner_id and p.owner_id in users_map:
                pr.owner = users_map[p.owner_id]
            result.append(pr)
            
        return result
    
    def get_plan(self, plan_id: str) -> Optional[PlanResponse]:
        """Load a single plan by id and populate owner/members summaries.
        
        Args:
            plan_id: Plan identifier.
            
        Returns:
            PlanResponse or None if not found.
        """
        data = self.storage_manager.load_data(
            'mongodb',
            plan_id,
            collection_name=self.collection_name
        )
        if not data:
            return None
            
        plan = Plan(**data)
        plan_response = PlanResponse(**plan.model_dump())
        
        # Populate owner and members
        adapter = self.storage_manager.adapters.get('mongodb')
        if adapter:
            user_ids_to_fetch = set()
            if plan.owner_id:
                user_ids_to_fetch.add(plan.owner_id)
            if plan.member_ids:
                user_ids_to_fetch.update(plan.member_ids)
                
            if user_ids_to_fetch:
                users_map = self._fetch_users_map(adapter, list(user_ids_to_fetch))
                
                if plan.owner_id and plan.owner_id in users_map:
                    plan_response.owner = users_map[plan.owner_id]
                    
                if plan.member_ids:
                    plan_response.members = [
                        users_map[mid] for mid in plan.member_ids if mid in users_map
                    ]
                    
        return plan_response
    
    def update_plan(self, plan_id: str, update_data: Dict[str, Any]) -> Optional[Plan]:
        """Update a plan document with allowed fields.
        
        Args:
            plan_id: Plan identifier.
            update_data: Mapping of fields to update.
            
        Returns:
            Updated plan model or None if not found.
        """
        raw_data = self.storage_manager.load_data(
            'mongodb',
            plan_id,
            collection_name=self.collection_name
        )
        if not raw_data:
            return None
            
        current_plan = Plan(**raw_data)
        
        # Update allowed fields
        plan_dict = current_plan.model_dump()
        allowed_fields = {
            'name', 'description', 'region', 'planned_start_date',
            'planned_end_date', 'is_public', 'status', 'cover_image_url'
        }
        
        for key, value in update_data.items():
            if key in allowed_fields and key in plan_dict:
                plan_dict[key] = value
                
        # Update timestamp
        plan_dict['updated_at'] = datetime.utcnow()
        
        updated_plan = Plan(**plan_dict)
        
        self.storage_manager.save_data(
            plan_id,
            updated_plan.model_dump(by_alias=True),
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
        
        logger.info(f"Updated plan: {plan_id}")
        return updated_plan
    
    def delete_plan(self, plan_id: str) -> bool:
        """Delete a plan.
        
        Args:
            plan_id: Plan identifier to delete.
            
        Returns:
            True if the plan was deleted, False otherwise.
        """
        existing_plan = self.get_plan(plan_id)
        if not existing_plan:
            return False
            
        deleted = self.storage_manager.delete_data(
            plan_id,
            adapter_name='mongodb',
            collection_name=self.collection_name
        )
        
        if deleted:
            logger.info(f"Deleted plan: {plan_id}")
            
        return bool(deleted)
    
    def update_members(self, plan_id: str, member_ids: List[str], current_user_id: str) -> Optional[Plan]:
        """Update plan membership list (owner-only operation).
        
        Args:
            plan_id: Plan identifier.
            member_ids: The complete new list of member ids.
            current_user_id: ID of the user performing the update.
            
        Returns:
            The updated plan, or None if not found.
            
        Raises:
            PermissionError: If current_user_id is not the plan owner.
        """
        raw_data = self.storage_manager.load_data(
            'mongodb', plan_id, collection_name=self.collection_name
        )
        if not raw_data:
            return None
            
        plan = Plan(**raw_data)
        
        # Check permission
        if plan.owner_id != current_user_id:
            raise PermissionError("Only the owner can manage members.")
            
        # Ensure owner is always a member
        new_member_set = set(member_ids)
        if plan.owner_id:
            new_member_set.add(plan.owner_id)
            
        final_member_ids = list(new_member_set)
        
        # Update via direct MongoDB operation
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not configured")
            
        collection = adapter.get_collection(self.collection_name)
        result = collection.update_one(
            {"_id": plan_id},
            {"$set": {
                "member_ids": final_member_ids,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.matched_count == 0:
            return None
            
        return self.get_plan(plan_id)
    
    # -------------------------------------------------------------------------
    # Feature Management
    # -------------------------------------------------------------------------
    
    def add_feature(self, plan_id: str, geometry: GeoJSONGeometry, 
                    properties: Optional[Dict[str, Any]] = None) -> Optional[PlanFeature]:
        """Add a GeoJSON feature to a plan's feature collection.
        
        Args:
            plan_id: Plan identifier.
            geometry: GeoJSON geometry object.
            properties: Optional feature properties.
            
        Returns:
            The created feature, or None if plan not found.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
        
        # Log incoming properties for debugging
        logger.debug(f"add_feature: Received properties: {properties}")
            
        # Build feature
        feature_props = PlanFeatureProperties(**(properties or {}))
        feature_props.created_at = datetime.utcnow()
        
        logger.debug(f"add_feature: Created PlanFeatureProperties with category={feature_props.category}")
        
        feature = PlanFeature(
            geometry=geometry,
            properties=feature_props
        )
        
        collection = adapter.get_collection(self.collection_name)
        result = collection.update_one(
            {"_id": plan_id},
            {
                "$push": {"features.features": feature.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            return None
            
        logger.info(f"Added feature {feature.id} to plan {plan_id}")
        
        # Dispatch event for cross-component sync
        EventBus.publish("PLAN_FEATURE_CREATED", {
            "plan_id": plan_id,
            "feature_id": feature.id,
            "geometry_type": geometry.type
        })
        
        return feature
    
    def update_feature(self, plan_id: str, feature_id: str, 
                       updates: Dict[str, Any]) -> Optional[PlanFeature]:
        """Update a specific feature within a plan.
        
        Args:
            plan_id: Plan identifier.
            feature_id: Feature identifier.
            updates: Dictionary with 'geometry' and/or 'properties' updates.
            
        Returns:
            Updated feature or None if not found.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        collection = adapter.get_collection(self.collection_name)
        
        # Build update expression for nested feature
        update_fields: Dict[str, Any] = {}
        
        if "geometry" in updates and updates["geometry"]:
            update_fields["features.features.$[elem].geometry"] = updates["geometry"]
            
        if "properties" in updates and updates["properties"]:
            for key, value in updates["properties"].items():
                update_fields[f"features.features.$[elem].properties.{key}"] = value
                
        # Always update the timestamp
        update_fields["features.features.$[elem].properties.updated_at"] = datetime.utcnow()
        update_fields["updated_at"] = datetime.utcnow()
        
        result = collection.update_one(
            {"_id": plan_id},
            {"$set": update_fields},
            array_filters=[{"elem.id": feature_id}]
        )
        
        if result.matched_count == 0:
            return None
            
        # Fetch and return the updated feature
        plan = self.get_plan(plan_id)
        if plan:
            for f in plan.features.features:
                if f.id == feature_id:
                    return f
                    
        return None
    
    def delete_feature(self, plan_id: str, feature_id: str) -> bool:
        """Remove a feature from a plan.
        
        Args:
            plan_id: Plan identifier.
            feature_id: Feature identifier.
            
        Returns:
            True if feature was deleted, False otherwise.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        collection = adapter.get_collection(self.collection_name)
        
        result = collection.update_one(
            {"_id": plan_id},
            {
                "$pull": {"features.features": {"id": feature_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Deleted feature {feature_id} from plan {plan_id}")
            return True
            
        return False
    
    def reorder_features(self, plan_id: str, feature_orders: List[Dict[str, Any]]) -> bool:
        """Batch update feature order_index values.
        
        Args:
            plan_id: Plan identifier.
            feature_orders: List of {feature_id, order_index} mappings.
            
        Returns:
            True if update succeeded, False otherwise.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        collection = adapter.get_collection(self.collection_name)
        
        # Update each feature's order_index
        for item in feature_orders:
            feature_id = item.get("feature_id")
            order_index = item.get("order_index")
            
            if feature_id is not None and order_index is not None:
                collection.update_one(
                    {"_id": plan_id},
                    {"$set": {
                        "features.features.$[elem].properties.order_index": order_index
                    }},
                    array_filters=[{"elem.id": feature_id}]
                )
                
        # Update plan timestamp
        collection.update_one(
            {"_id": plan_id},
            {"$set": {"updated_at": datetime.utcnow()}}
        )
        
        return True
    
    # -------------------------------------------------------------------------
    # Reference Track Management
    # -------------------------------------------------------------------------
    
    def add_reference_track(self, plan_id: str, track_data: ReferenceTrackAdd) -> Optional[ReferenceTrack]:
        """Add a reference GPX track to a plan.
        
        Args:
            plan_id: Plan identifier.
            track_data: Reference track details.
            
        Returns:
            The created reference track, or None if plan not found.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        track = ReferenceTrack(
            object_key=track_data.object_key,
            filename=track_data.filename,
            display_name=track_data.display_name,
            color=track_data.color or "#888888",
            opacity=track_data.opacity or 0.5
        )
        
        collection = adapter.get_collection(self.collection_name)
        result = collection.update_one(
            {"_id": plan_id},
            {
                "$push": {"reference_tracks": track.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            return None
            
        logger.info(f"Added reference track {track.id} to plan {plan_id}")
        return track
    
    def remove_reference_track(self, plan_id: str, track_id: str) -> bool:
        """Remove a reference track from a plan.
        
        Args:
            plan_id: Plan identifier.
            track_id: Reference track identifier.
            
        Returns:
            True if track was removed, False otherwise.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
            
        collection = adapter.get_collection(self.collection_name)
        
        result = collection.update_one(
            {"_id": plan_id},
            {
                "$pull": {"reference_tracks": {"id": track_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return result.modified_count > 0
    
    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------
    
    def _fetch_users_map(self, adapter, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Fetch user summaries for a list of user IDs.
        
        Args:
            adapter: MongoDB adapter.
            user_ids: List of user IDs to fetch.
            
        Returns:
            Dict mapping user_id to user summary.
        """
        if not user_ids:
            return {}
            
        users_collection = adapter.get_collection('users')
        obj_ids = []
        
        for uid in user_ids:
            try:
                obj_ids.append(ObjectId(uid))
            except Exception:
                pass
                
        if not obj_ids:
            return {}
            
        users_cursor = users_collection.find({"_id": {"$in": obj_ids}})
        users_map = {}
        
        for u in users_cursor:
            uid = str(u["_id"])
            users_map[uid] = {
                "id": uid,
                "username": u.get("username", "Unknown"),
                "avatar_url": u.get("avatar_url")
            }
            
        return users_map


# Singleton instance for convenience
plan_service = PlanService()
