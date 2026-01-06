"""Time Shift calculation service for Plan features.

Implements the "Relative Time Shift" algorithm from HLD Section 5.1.
This service calculates time offsets for GPX waypoints and projects
them onto a new planned start date.

The algorithm:
1. Extract GPX_Start_Time (from first track point or waypoint)
2. For each waypoint: Δt = W_i.time - GPX_Start_Time
3. New_Arrival = Plan_Start_Time + Δt
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging

from src.models.plan import (
    PlanFeature, PlanFeatureProperties, DetectedWaypoint,
    GpxIngestionStrategy, FeatureCategory, GeoJSONGeometry
)

logger = logging.getLogger(__name__)


class TimeShiftService:
    """Calculate time offsets and projected arrival times for Plan features.
    
    This service handles:
    - Converting GPX waypoints to Plan features with time projections
    - Calculating time offsets from source GPX timestamps
    - Cascading time updates when a checkpoint is modified
    """
    
    @staticmethod
    def calculate_time_offset(
        waypoint_time: datetime,
        gpx_start_time: datetime
    ) -> float:
        """Calculate offset in seconds from GPX start time.
        
        Algorithm: Δt = W_i.time - GPX_Start_Time
        
        Args:
            waypoint_time: The timestamp of the waypoint.
            gpx_start_time: The start time of the GPX track.
            
        Returns:
            Time offset in seconds (float).
        """
        delta = waypoint_time - gpx_start_time
        return delta.total_seconds()
    
    @staticmethod
    def apply_time_shift(
        time_offset_seconds: float,
        plan_start_time: datetime
    ) -> datetime:
        """Project arrival time based on plan start.
        
        Algorithm: New_Arrival = Plan_Start_Time + Δt
        
        Args:
            time_offset_seconds: The offset in seconds from the original start.
            plan_start_time: The planned start time for the new Plan.
            
        Returns:
            Projected arrival datetime.
        """
        return plan_start_time + timedelta(seconds=time_offset_seconds)
    
    @classmethod
    def convert_waypoints_to_features(
        cls,
        waypoints: List[DetectedWaypoint],
        gpx_start_time: Optional[datetime],
        plan_start_time: Optional[datetime],
        strategy: GpxIngestionStrategy,
        selected_indices: Optional[List[int]] = None
    ) -> List[PlanFeature]:
        """Convert detected GPX waypoints to Plan features.
        
        Applies the specified time strategy to project waypoint times
        onto the new Plan's timeline.
        
        Args:
            waypoints: Parsed waypoints from GPX file.
            gpx_start_time: Original GPX start timestamp.
            plan_start_time: Planned start time for the Plan.
            strategy: Time application strategy (relative, absolute, or no_times).
            selected_indices: If provided, only convert waypoints at these indices.
            
        Returns:
            List of PlanFeature objects with projected times.
        """
        features = []
        
        for idx, wp in enumerate(waypoints):
            # Filter by selection if specified
            if selected_indices is not None and idx not in selected_indices:
                continue
            
            # Build base properties
            props_dict: Dict[str, Any] = {
                'category': FeatureCategory.WAYPOINT,
                'name': wp.name or f"Checkpoint {len(features) + 1}",
                'elevation': wp.ele,
                'order_index': len(features),
            }
            
            # Apply time shift strategy
            if strategy == GpxIngestionStrategy.NO_TIMES:
                # No time information - user will set manually
                pass
            elif wp.time:
                # Preserve original GPX time
                props_dict['original_gpx_time'] = wp.time
                
                if strategy == GpxIngestionStrategy.RELATIVE_TIME_SHIFT:
                    if gpx_start_time and plan_start_time:
                        offset = cls.calculate_time_offset(wp.time, gpx_start_time)
                        props_dict['time_offset_seconds'] = offset
                        props_dict['estimated_arrival'] = cls.apply_time_shift(offset, plan_start_time)
                    else:
                        logger.warning(
                            f"Cannot apply relative time shift: missing gpx_start_time or plan_start_time"
                        )
                elif strategy == GpxIngestionStrategy.ABSOLUTE_TIMES:
                    props_dict['estimated_arrival'] = wp.time
                    # No offset stored for absolute mode
            
            # Build PlanFeatureProperties
            props = PlanFeatureProperties(**props_dict)
            
            # Build GeoJSON geometry (note: GeoJSON uses [lon, lat] order)
            geometry = GeoJSONGeometry(
                type="Point",
                coordinates=[wp.lon, wp.lat]
            )
            
            # Create the feature
            feature = PlanFeature(
                geometry=geometry,
                properties=props
            )
            features.append(feature)
        
        logger.info(f"Converted {len(features)} waypoints to features using strategy: {strategy}")
        return features
    
    @classmethod
    def cascade_time_update(
        cls,
        features: List[PlanFeature],
        updated_feature_id: str,
        new_arrival: datetime
    ) -> List[PlanFeature]:
        """Propagate time changes to downstream features.
        
        When a feature's estimated_arrival is updated, this method shifts
        all subsequent features (by order_index) by the same time delta.
        
        Args:
            features: List of all features in the Plan.
            updated_feature_id: ID of the feature being updated.
            new_arrival: The new arrival time for the updated feature.
            
        Returns:
            Updated list of features with cascaded time changes.
        """
        # Find the updated feature
        updated_feature = None
        
        for f in features:
            if f.id == updated_feature_id:
                updated_feature = f
                break
        
        if not updated_feature:
            logger.warning(f"Feature {updated_feature_id} not found for cascade update")
            return features
        
        old_arrival = updated_feature.properties.estimated_arrival
        if old_arrival is None:
            logger.warning(f"Feature {updated_feature_id} has no estimated_arrival to cascade from")
            # Just update this feature
            updated_feature.properties.estimated_arrival = new_arrival
            updated_feature.properties.updated_at = datetime.utcnow()
            return features
        
        # Calculate delta
        delta = new_arrival - old_arrival
        
        # Get the order_index of updated feature
        updated_order = updated_feature.properties.order_index
        if updated_order is None:
            logger.warning(f"Feature {updated_feature_id} has no order_index, skipping cascade")
            updated_feature.properties.estimated_arrival = new_arrival
            updated_feature.properties.updated_at = datetime.utcnow()
            return features
        
        # Update subsequent features (those with higher order_index)
        cascade_count = 0
        for f in features:
            f_order = f.properties.order_index
            if f_order is not None and f_order > updated_order:
                if f.properties.estimated_arrival is not None:
                    f.properties.estimated_arrival = f.properties.estimated_arrival + delta
                    f.properties.updated_at = datetime.utcnow()
                    cascade_count += 1
        
        # Update the target feature itself
        updated_feature.properties.estimated_arrival = new_arrival
        updated_feature.properties.updated_at = datetime.utcnow()
        
        logger.info(
            f"Cascade time update: updated feature {updated_feature_id} and "
            f"{cascade_count} downstream features by {delta}"
        )
        
        return features
    
    @classmethod
    def recalculate_all_times(
        cls,
        features: List[PlanFeature],
        new_plan_start: datetime
    ) -> List[PlanFeature]:
        """Recalculate all estimated_arrival times based on a new plan start.
        
        Uses stored time_offset_seconds to reproject all waypoints when
        the Plan's planned_start_date changes.
        
        Args:
            features: List of all features in the Plan.
            new_plan_start: The new planned start datetime.
            
        Returns:
            Updated list of features with recalculated times.
        """
        updated_count = 0
        
        for f in features:
            if f.properties.category == FeatureCategory.WAYPOINT:
                offset = f.properties.time_offset_seconds
                if offset is not None:
                    f.properties.estimated_arrival = cls.apply_time_shift(offset, new_plan_start)
                    f.properties.updated_at = datetime.utcnow()
                    updated_count += 1
        
        logger.info(f"Recalculated times for {updated_count} features with new start: {new_plan_start}")
        return features


# Singleton instance for convenience
time_shift_service = TimeShiftService()
