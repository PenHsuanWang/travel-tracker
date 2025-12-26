"""Service for managing Plan lifecycle and GeoJSON features.

This service follows the same patterns as TripService, using the
StorageManager with MongoDB adapter for persistence. It provides
CRUD operations for Plans, feature management, reference tracks,
member management, and GPX ingestion for trip planning.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging
import uuid

from src.models.plan import (
    Plan, PlanResponse, PlanCreate, PlanUpdate,
    PlanFeature, PlanFeatureCollection, PlanFeatureProperties,
    ReferenceTrack, ReferenceTrackAdd,
    PlanStatus, GeoJSONGeometry,
    GpxIngestionPreview, GpxIngestionStrategy, DetectedWaypoint,
    GpxStrategyPayload
)
from src.utils.dbbutler.storage_manager import StorageManager
from src.utils.adapter_factory import AdapterFactory
from src.events.event_bus import EventBus
from src.services.time_shift_service import time_shift_service
from src.services.trip_service import TripService
from src.services.gpx_analysis_service import GpxAnalysisService

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
        # Initialize MinIO adapter for GPX/reference track storage
        try:
            minio_adapter = AdapterFactory.create_minio_adapter()
            self.storage_manager.add_adapter('minio', minio_adapter)
        except Exception as exc:
            # Degrade gracefully but log; upload endpoints will raise if used without MinIO
            logger.error(f"Failed to initialize MinIO adapter: {exc}")
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
    
    def upload_reference_track(
        self, 
        plan_id: str, 
        file_bytes: bytes, 
        filename: str, 
        user_id: str,
        display_name: Optional[str] = None,
        color: Optional[str] = None,
        opacity: Optional[float] = None
    ) -> Optional[ReferenceTrack]:
        """Upload a GPX file and add it as a reference track.
        
        Args:
            plan_id: Plan identifier.
            file_bytes: Raw GPX file content.
            filename: Original filename.
            user_id: User performing the upload.
            display_name: Display name for the track.
            color: Track color (hex).
            opacity: Track opacity (0-1).
            
        Returns:
            The created reference track, or None if failed.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        minio_adapter = self.storage_manager.adapters.get('minio')
        
        if not adapter:
            raise RuntimeError("MongoDB adapter not initialized")
        if not minio_adapter:
            raise RuntimeError("MinIO adapter not initialized")
        
        # Get plan to verify it exists
        plan = self.get_plan(plan_id)
        if not plan:
            return None
        
        # Generate object key for MinIO storage
        import uuid as uuid_module
        file_id = str(uuid_module.uuid4())
        object_key = f"plans/{plan.owner_id}/{plan_id}/reference-tracks/{file_id}_{filename}"
        
        # Upload to MinIO
        try:
            from io import BytesIO
            bucket_name = "gps-data"
            # Ensure bucket exists (idempotent)
            if not minio_adapter.client.bucket_exists(bucket_name):
                minio_adapter.client.make_bucket(bucket_name)
            minio_adapter.client.put_object(
                bucket_name=bucket_name,
                object_name=object_key,
                data=BytesIO(file_bytes),
                length=len(file_bytes),
                content_type="application/gpx+xml"
            )
        except Exception as e:
            logger.error(f"Failed to upload GPX to MinIO: {e}")
            raise ValueError(f"Failed to upload GPX file: {e}")
        
        # Create reference track entry
        track = ReferenceTrack(
            object_key=object_key,
            filename=filename,
            display_name=display_name or filename.replace('.gpx', '').replace('.GPX', ''),
            color=color or "#f59e0b",  # Amber color for reference tracks
            opacity=opacity if opacity is not None else 0.7
        )
        
        # Add to plan
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
            
        logger.info(f"Uploaded reference track {track.id} to plan {plan_id}")
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

    # -------------------------------------------------------------------------
    # GPX Ingestion Methods
    # -------------------------------------------------------------------------
    
    def ingest_gpx(self, file_bytes: bytes, filename: str, user_id: str) -> GpxIngestionPreview:
        """Parse GPX file and return preview for strategy selection.
        
        This method stores the file temporarily in MinIO and returns
        parsed data for the user to preview before creating a plan.
        
        Args:
            file_bytes: Raw GPX file content.
            filename: Original filename.
            user_id: ID of the uploading user.
            
        Returns:
            GpxIngestionPreview with parsed track and waypoints.
        """
        # 1. Analyze GPX
        result = GpxAnalysisService.analyze_gpx_data(file_bytes, filename)
        
        # 2. Store temp file in MinIO
        temp_key = f"temp/{user_id}/{uuid.uuid4()}.gpx"
        minio_adapter = self.storage_manager.adapters.get('minio')
        if not minio_adapter:
            # Try to initialize MinIO adapter
            try:
                minio_adapter = AdapterFactory.create_minio_adapter()
                self.storage_manager.add_adapter('minio', minio_adapter)
            except Exception as e:
                logger.error(f"Failed to initialize MinIO adapter: {e}")
                raise RuntimeError("Storage not available for GPX upload")
        
        minio_adapter.save_data(temp_key, file_bytes, bucket='gps-data')
        
        # 3. Extract waypoints from analyzed track
        waypoints = self._extract_waypoints_from_track(result.analyzed_track)
        
        # 4. Extract track geometry for map preview
        track_coords = self._extract_track_geometry(result.analyzed_track)
        track_geometry = None
        if track_coords:
            track_geometry = {
                "type": "LineString",
                "coordinates": track_coords
            }
        
        # 5. Parse start/end times from summary
        gpx_start_time = self._parse_datetime(result.summary.get('start_time'))
        gpx_end_time = self._parse_datetime(result.summary.get('end_time'))
        
        logger.info(f"Ingested GPX '{filename}' with {len(waypoints)} waypoints, stored as {temp_key}")
        
        # Publish event for analytics
        EventBus.publish("PLAN_GPX_INGESTED", {
            "user_id": user_id,
            "filename": filename,
            "waypoint_count": len(waypoints),
            "temp_key": temp_key
        })
        
        return GpxIngestionPreview(
            temp_file_key=temp_key,
            track_geometry=track_geometry,
            track_summary=result.summary,
            detected_waypoints=waypoints,
            gpx_start_time=gpx_start_time,
            gpx_end_time=gpx_end_time
        )
    
    def create_plan_with_gpx(
        self,
        plan_data: Plan,
        gpx_strategy: GpxStrategyPayload
    ) -> Plan:
        """Create a new plan with GPX-based features.
        
        Moves the temporary GPX file to the plan's reference track path
        and creates features from the parsed waypoints.
        
        Args:
            plan_data: Base plan data.
            gpx_strategy: GPX import strategy with temp file key.
            
        Returns:
            Created Plan with features and reference track.
        """
        minio_adapter = self.storage_manager.adapters.get('minio')
        if not minio_adapter:
            raise RuntimeError("MinIO adapter not available")
        
        # 1. Load temp GPX file
        gpx_bytes = minio_adapter.load_data(gpx_strategy.temp_file_key, bucket='gps-data')
        if not gpx_bytes:
            raise ValueError(f"Temporary GPX file not found: {gpx_strategy.temp_file_key}")
        
        # 2. Re-analyze to get waypoints
        filename = gpx_strategy.temp_file_key.split('/')[-1]
        result = GpxAnalysisService.analyze_gpx_data(gpx_bytes, filename)
        
        # 3. Move GPX to permanent location
        ref_key = f"plans/{plan_data.owner_id}/{plan_data.id}/reference.gpx"
        minio_adapter.save_data(ref_key, gpx_bytes, bucket='gps-data')
        
        # 4. Delete temp file
        try:
            minio_adapter.delete_data(gpx_strategy.temp_file_key, bucket='gps-data')
        except Exception as e:
            logger.warning(f"Failed to delete temp file {gpx_strategy.temp_file_key}: {e}")
        
        # 5. Add reference track
        plan_data.reference_tracks.append(ReferenceTrack(
            object_key=ref_key,
            filename=filename,
            display_name="Imported GPX Track"
        ))
        
        # 6. Extract and convert waypoints
        waypoints = self._extract_waypoints_from_track(result.analyzed_track)
        gpx_start = self._parse_datetime(result.summary.get('start_time'))
        
        features = time_shift_service.convert_waypoints_to_features(
            waypoints=waypoints,
            gpx_start_time=gpx_start,
            plan_start_time=plan_data.planned_start_date,
            strategy=gpx_strategy.mode,
            selected_indices=gpx_strategy.selected_waypoint_indices
        )
        
        plan_data.features = PlanFeatureCollection(features=features)
        
        # 7. Persist the plan
        return self.create_plan(plan_data)
    
    def create_plan_from_trip(
        self,
        trip_id: str,
        user_id: str,
        name: str,
        planned_start_date: Optional[datetime],
        strategy: GpxIngestionStrategy = GpxIngestionStrategy.RELATIVE_TIME_SHIFT
    ) -> Plan:
        """Clone a Trip into a new Plan (FR-012).
        
        Copies the Trip's GPX file as a reference track and converts
        waypoints to Plan features. The resulting Plan has NO link
        to the original Trip (fully decoupled).
        
        Args:
            trip_id: Source Trip ID.
            user_id: ID of the user creating the plan.
            name: Name for the new plan.
            planned_start_date: Planned start date for time shifting.
            strategy: Time shift strategy to apply.
            
        Returns:
            Created Plan with reference track and features.
            
        Raises:
            ValueError: If Trip not found or has no GPX file.
            PermissionError: If user has no access to the Trip.
        """
        trip_service = TripService()
        
        # 1. Get Trip
        trip = trip_service.get_trip(trip_id)
        if not trip:
            raise ValueError(f"Trip not found: {trip_id}")
        
        # 2. Check permission
        trip_owner = str(trip.owner_id) if trip.owner_id else None
        trip_members = [str(m) for m in trip.member_ids] if trip.member_ids else []
        
        if trip_owner != user_id and user_id not in trip_members:
            raise PermissionError("You don't have access to this trip")
        
        # 3. Find Trip's GPX file
        gpx_metadata = self._find_trip_gpx(trip_id)
        if not gpx_metadata:
            raise ValueError("Trip has no GPX file to import")
        
        # 4. Load GPX bytes from MinIO
        minio_adapter = self.storage_manager.adapters.get('minio')
        if not minio_adapter:
            try:
                minio_adapter = AdapterFactory.create_minio_adapter()
                self.storage_manager.add_adapter('minio', minio_adapter)
            except Exception as e:
                raise RuntimeError(f"Storage not available: {e}")
        
        gpx_bytes = minio_adapter.load_data(gpx_metadata['object_key'], bucket='gps-data')
        if not gpx_bytes:
            raise ValueError("Failed to load GPX file from storage")
        
        # 5. Analyze GPX
        result = GpxAnalysisService.analyze_gpx_data(gpx_bytes, gpx_metadata['filename'])
        
        # 6. Create Plan
        plan = Plan(
            name=name,
            owner_id=user_id,
            member_ids=[user_id],
            region=trip.region,
            description=f"Cloned from trip: {trip.name}",
            planned_start_date=planned_start_date
        )
        
        # 7. Copy GPX to plan's reference track path
        ref_key = f"plans/{user_id}/{plan.id}/reference.gpx"
        minio_adapter.save_data(ref_key, gpx_bytes, bucket='gps-data')
        
        # 8. Add reference track
        plan.reference_tracks.append(ReferenceTrack(
            object_key=ref_key,
            filename=gpx_metadata['filename'],
            display_name=f"Reference from: {trip.name}"
        ))
        
        # 9. Convert waypoints using Time Shift
        waypoints = self._extract_waypoints_from_track(result.analyzed_track)
        gpx_start = self._parse_datetime(result.summary.get('start_time'))
        
        features = time_shift_service.convert_waypoints_to_features(
            waypoints=waypoints,
            gpx_start_time=gpx_start,
            plan_start_time=planned_start_date,
            strategy=strategy
        )
        
        plan.features = PlanFeatureCollection(features=features)
        
        # 10. Persist
        logger.info(f"Created plan '{name}' from trip '{trip.name}' with {len(features)} features")
        return self.create_plan(plan)
    
    def update_feature_with_cascade(
        self,
        plan_id: str,
        feature_id: str,
        updates: Dict[str, Any],
        cascade: bool = False
    ) -> Optional[Plan]:
        """Update a feature with optional cascade time propagation.
        
        If cascade is True and estimated_arrival is being updated,
        propagate the time delta to all subsequent features.
        
        Args:
            plan_id: Plan identifier.
            feature_id: Feature identifier.
            updates: Dictionary with 'geometry' and/or 'properties'.
            cascade: Whether to cascade time updates.
            
        Returns:
            Updated Plan or None if not found.
        """
        # Get the current plan
        plan = self.get_plan(plan_id)
        if not plan:
            return None
        
        # Check if this is a time cascade update
        new_arrival = None
        if cascade and 'properties' in updates:
            new_arrival_str = updates['properties'].get('estimated_arrival')
            if new_arrival_str:
                new_arrival = self._parse_datetime(new_arrival_str)
        
        if cascade and new_arrival:
            # Apply cascade update to all features
            features_list = list(plan.features.features) if plan.features else []
            
            updated_features = time_shift_service.cascade_time_update(
                features=features_list,
                updated_feature_id=feature_id,
                new_arrival=new_arrival
            )
            
            # Save all updated features back to the plan
            adapter = self.storage_manager.adapters.get('mongodb')
            if adapter:
                collection = adapter.get_collection(self.collection_name)
                
                # Convert features to dicts
                features_dicts = [f.model_dump() for f in updated_features]
                
                collection.update_one(
                    {"_id": plan_id},
                    {"$set": {
                        "features.features": features_dicts,
                        "updated_at": datetime.utcnow()
                    }}
                )
            
            return self.get_plan(plan_id)
        else:
            # Normal update without cascade
            return self.update_feature(plan_id, feature_id, updates)
    
    def _extract_waypoints_from_track(self, analyzed_track) -> List[DetectedWaypoint]:
        """Extract waypoints from an analyzed GPX track object.
        
        Uses the gpxana library API: get_waypoint_list() returns explicit GPX waypoints.
        If no waypoints are found, falls back to extracting key points from the track.
        
        Args:
            analyzed_track: AnalyzedTrackObject from gpxana library.
            
        Returns:
            List of DetectedWaypoint objects.
        """
        waypoints = []
        
        try:
            # Use gpxana API: get_waypoint_list() returns explicit GPX waypoints
            raw_waypoints = analyzed_track.get_waypoint_list() or []
                
            for wp in raw_waypoints:
                # gpxana waypoints may expose lat/lon OR latitude/longitude
                lat_val = (
                    getattr(wp, 'lat', None)
                    or getattr(wp, 'latitude', None)
                    or 0
                )
                lon_val = (
                    getattr(wp, 'lon', None)
                    or getattr(wp, 'longitude', None)
                    or 0
                )
                ele_val = getattr(wp, 'elevation', None) or getattr(wp, 'elev', None) or getattr(wp, 'ele', None)
                # Prefer waypoint note as name, then name/desc
                # gpxana waypoints often expose get_note(); fall back to note/description/desc
                note_val = None
                try:
                    note_val = wp.get_note()  # type: ignore[attr-defined]
                except Exception:
                    note_val = getattr(wp, 'note', None) or getattr(wp, 'description', None) or getattr(wp, 'desc', None)
                name_val = (
                    note_val
                    or getattr(wp, 'name', None)
                    or getattr(wp, 'desc', None)
                    or getattr(wp, 'description', None)
                )
                
                if lat_val or lon_val:
                    waypoint = DetectedWaypoint(
                        name=name_val,
                        note=note_val,
                        lat=float(lat_val),
                        lon=float(lon_val),
                        ele=float(ele_val) if ele_val is not None else None,
                        time=getattr(wp, 'time', None)
                    )
                    waypoints.append(waypoint)
                
        except Exception as e:
            logger.warning(f"Failed to extract waypoints from track: {e}")
        
        # If no waypoints found, try to extract key points from track
        if not waypoints:
            logger.info("No explicit waypoints found in GPX, attempting to extract key points from track")
            waypoints = self._extract_key_points_from_track(analyzed_track)
        
        # Warn if still no waypoints found after all extraction attempts
        if not waypoints:
            logger.warning(
                "No waypoints could be extracted from GPX track. "
                "The GPX file may not contain waypoint data or recognizable key points."
            )
        
        return waypoints
    
    def _extract_key_points_from_track(self, analyzed_track) -> List[DetectedWaypoint]:
        """Extract key points (start, end, rest points) from track when no waypoints exist.
        
        Uses gpxana library API to extract:
        - Start point (first track point)
        - End point (last track point)  
        - Rest points (detected rest/pause locations)
        """
        waypoints = []
        
        try:
            # Get track points using gpxana API
            main_tracks = analyzed_track.get_main_tracks()
            points = main_tracks.get_main_tracks_points_list() if main_tracks else []
            
            if points and len(points) > 0:
                # Add start point - support both lat/lon and latitude/longitude field names
                start = points[0]
                start_lat = (
                    getattr(start, 'lat', None)
                    or getattr(start, 'latitude', None)
                    or 0
                )
                start_lon = (
                    getattr(start, 'lon', None)
                    or getattr(start, 'longitude', None)
                    or 0
                )
                start_ele = getattr(start, 'elevation', None) or getattr(start, 'elev', None)
                
                if start_lat or start_lon:
                    waypoints.append(DetectedWaypoint(
                        name="Start",
                        lat=float(start_lat),
                        lon=float(start_lon),
                        ele=float(start_ele) if start_ele is not None else None,
                        time=getattr(start, 'time', None)
                    ))
                
                # Add end point
                end = points[-1]
                end_lat = (
                    getattr(end, 'lat', None)
                    or getattr(end, 'latitude', None)
                    or 0
                )
                end_lon = (
                    getattr(end, 'lon', None)
                    or getattr(end, 'longitude', None)
                    or 0
                )
                end_ele = getattr(end, 'elevation', None) or getattr(end, 'elev', None)
                
                if end_lat or end_lon:
                    waypoints.append(DetectedWaypoint(
                        name="End",
                        lat=float(end_lat),
                        lon=float(end_lon),
                        ele=float(end_ele) if end_ele is not None else None,
                        time=getattr(end, 'time', None)
                    ))
                        
            # Get rest points using gpxana API: get_rest_point_list()
            rest_points = analyzed_track.get_rest_point_list() or []
            for i, rp in enumerate(rest_points[:10]):  # Limit to 10 rest points
                rp_lat = (
                    getattr(rp, 'lat', None)
                    or getattr(rp, 'latitude', None)
                    or 0
                )
                rp_lon = (
                    getattr(rp, 'lon', None)
                    or getattr(rp, 'longitude', None)
                    or 0
                )
                rp_ele = getattr(rp, 'elevation', None) or getattr(rp, 'elev', None)
                
                if rp_lat or rp_lon:
                    waypoints.append(DetectedWaypoint(
                        name=f"Rest Stop {i + 1}",
                        lat=float(rp_lat),
                        lon=float(rp_lon),
                        ele=float(rp_ele) if rp_ele is not None else None,
                        time=getattr(rp, 'time', None)
                    ))
                    
        except Exception as e:
            logger.warning(f"Failed to extract key points from track: {e}")
        
        return waypoints
    
    def _extract_track_geometry(self, analyzed_track) -> List[List[float]]:
        """Extract track geometry as [[lon, lat], ...] for map rendering.
        
        Uses gpxana API to get track points and extracts coordinates.
        Samples points if too many for performance.
        """
        geometry = []
        
        try:
            main_tracks = analyzed_track.get_main_tracks()
            points = main_tracks.get_main_tracks_points_list() if main_tracks else []
            
            if points:
                # Sample points if too many (for performance)
                step = max(1, len(points) // 1000)
                
                for i, pt in enumerate(points):
                    if i % step == 0:
                        # gpxana points may expose lat/lon OR latitude/longitude
                        lon_val = (
                            getattr(pt, 'lon', None)
                            or getattr(pt, 'longitude', None)
                            or 0
                        )
                        lat_val = (
                            getattr(pt, 'lat', None)
                            or getattr(pt, 'latitude', None)
                            or 0
                        )
                        geometry.append([float(lon_val), float(lat_val)])
                
                # Always include last point
                if len(geometry) > 0:
                    last = points[-1]
                    last_coord = [
                        float(getattr(last, 'lon', None) or getattr(last, 'longitude', None) or 0),
                        float(getattr(last, 'lat', None) or getattr(last, 'latitude', None) or 0)
                    ]
                    if geometry[-1] != last_coord:
                        geometry.append(last_coord)
                            
        except Exception as e:
            logger.warning(f"Failed to extract track geometry: {e}")
        
        return geometry
    
    def _find_trip_gpx(self, trip_id: str) -> Optional[Dict[str, Any]]:
        """Find the GPX file metadata for a trip.
        
        Args:
            trip_id: Trip identifier.
            
        Returns:
            Dict with 'object_key' and 'filename' or None if not found.
        """
        adapter = self.storage_manager.adapters.get('mongodb')
        if not adapter:
            return None
        
        # Query file_metadata collection for GPX files associated with this trip
        collection = adapter.get_collection('file_metadata')
        
        gpx_doc = collection.find_one({
            "trip_id": trip_id,
            "mime_type": {"$regex": "gpx|xml", "$options": "i"}
        })
        
        if gpx_doc:
            return {
                "object_key": gpx_doc.get("object_key"),
                "filename": gpx_doc.get("original_filename", "track.gpx")
            }
        
        return None
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        """Parse a datetime from various formats."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                pass
        return None


# Singleton instance for convenience
plan_service = PlanService()
