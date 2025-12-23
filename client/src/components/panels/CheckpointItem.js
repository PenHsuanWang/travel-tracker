// client/src/components/panels/CheckpointItem.js
/**
 * CheckpointItem - Displays a waypoint (checkpoint) with coordinates, time, and duration.
 * 
 * This component is used in the Checkpoints section of the ItineraryPanel.
 * It shows:
 * - Icon based on icon_type
 * - Name or "Unnamed Checkpoint"
 * - Coordinates (lat, lon)
 * - Arrival time (if set)
 * - Duration (if set)
 * - Inline time editing capability
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import CheckpointTimeEditor from './CheckpointTimeEditor';
import {
  getMarkerEmoji,
  formatCoordinates,
  formatArrivalTime,
  formatDuration,
} from '../../services/planService';
import './CheckpointItem.css';

const CheckpointItem = ({
  feature,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onCenter,
  readOnly,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const {
    name,
    estimated_arrival,
    estimated_duration_minutes,
    icon_type,
  } = feature.properties || {};
  
  // Extract coordinates from geometry
  const coordinates = feature.geometry?.coordinates;
  const formattedCoords = formatCoordinates(coordinates);
  
  // Format time and duration for display
  const formattedTime = formatArrivalTime(estimated_arrival);
  const formattedDuration = formatDuration(estimated_duration_minutes);
  
  // Get icon emoji
  const iconEmoji = getMarkerEmoji(icon_type);

  const handleClick = useCallback(() => {
    if (!isEditing) {
      onSelect(feature.id);
    }
  }, [isEditing, feature.id, onSelect]);

  const handleEditTime = useCallback((e) => {
    e.stopPropagation();
    if (!readOnly) {
      setIsEditing(true);
    }
  }, [readOnly]);

  const handleSaveTime = useCallback((newArrival, newDuration) => {
    onUpdate(feature.id, {
      properties: {
        ...feature.properties,
        estimated_arrival: newArrival,
        estimated_duration_minutes: newDuration,
      },
    });
    setIsEditing(false);
  }, [feature.id, feature.properties, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleCenterMap = useCallback((e) => {
    e.stopPropagation();
    if (onCenter && coordinates) {
      onCenter(feature.id, coordinates);
    }
  }, [feature.id, coordinates, onCenter]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(feature.id);
    }
  }, [feature.id, onDelete]);

  return (
    <div
      className={`checkpoint-item ${selected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      onClick={handleClick}
    >
      {/* Icon */}
      <span className="checkpoint-icon" title={icon_type || 'checkpoint'}>
        {iconEmoji}
      </span>
      
      {/* Main content */}
      <div className="checkpoint-content">
        <span className="checkpoint-name">
          {name || 'Unnamed Checkpoint'}
        </span>
        
        <span className="checkpoint-coords" title="Click to center map">
          <button 
            className="coords-button" 
            onClick={handleCenterMap}
            title="Center map on this checkpoint"
          >
            📍 {formattedCoords}
          </button>
        </span>
        
        {!isEditing ? (
          /* Display mode */
          <div className="checkpoint-time-display">
            <span className="checkpoint-arrival">
              📅 {formattedTime}
            </span>
            {formattedDuration && (
              <span className="checkpoint-duration">
                ⏱ {formattedDuration}
              </span>
            )}
          </div>
        ) : (
          /* Inline edit mode */
          <CheckpointTimeEditor
            arrival={estimated_arrival}
            duration={estimated_duration_minutes}
            onSave={handleSaveTime}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
      
      {/* Actions */}
      {!readOnly && (
        <div className="checkpoint-actions">
          {!isEditing && (
            <button 
              className="action-btn edit-time-btn"
              title="Edit time" 
              onClick={handleEditTime}
            >
              ⏰
            </button>
          )}
          <button 
            className="action-btn delete-btn"
            title="Delete checkpoint"
            onClick={handleDelete}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};

CheckpointItem.propTypes = {
  feature: PropTypes.shape({
    id: PropTypes.string.isRequired,
    geometry: PropTypes.shape({
      type: PropTypes.string,
      coordinates: PropTypes.array,
    }),
    properties: PropTypes.shape({
      name: PropTypes.string,
      icon_type: PropTypes.string,
      estimated_arrival: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      estimated_duration_minutes: PropTypes.number,
    }),
  }).isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  onCenter: PropTypes.func,
  readOnly: PropTypes.bool,
};

CheckpointItem.defaultProps = {
  selected: false,
  readOnly: false,
  onDelete: null,
  onCenter: null,
};

export default CheckpointItem;
