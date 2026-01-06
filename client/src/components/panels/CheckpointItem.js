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
 * - Cascade time update option when arrival time is changed
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
  onUpdateWithCascade, // Optional: for cascade time updates
  onDelete,
  onCenter,
  onFlyTo, // FE-06: Navigate map with flyTo + flash
  readOnly,
  hasSubsequentCheckpoints, // Whether there are checkpoints after this one
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [pendingTimeChange, setPendingTimeChange] = useState(null); // For cascade prompt
  
  const {
    name,
    estimated_arrival,
    estimated_duration_minutes,
    icon_type,
    semantic_type,
    hazard_subtype,
  } = feature.properties || {};
  
  // Extract coordinates from geometry
  const coordinates = feature.geometry?.coordinates;
  const formattedCoords = formatCoordinates(coordinates);
  
  // Format time and duration for display
  const formattedTime = formatArrivalTime(estimated_arrival);
  const formattedDuration = formatDuration(estimated_duration_minutes);
  
  // Determine icon and title based on semantic properties
  let iconEmoji = '📍';
  let iconTitle = icon_type || 'checkpoint';

  if (hazard_subtype === 'rock_climbing') {
    iconEmoji = '🧗';
    iconTitle = 'Rock Climbing';
  } else if (hazard_subtype === 'river_tracing') {
    iconEmoji = '🌊';
    iconTitle = 'River Tracing';
  } else if (semantic_type === 'hazard') {
    iconEmoji = '⚠️';
    iconTitle = 'Hazard';
  } else if (semantic_type === 'camp') {
    iconEmoji = '⛺';
    iconTitle = 'Camp';
  } else if (semantic_type === 'water') {
    iconEmoji = '💧';
    iconTitle = 'Water';
  } else if (semantic_type === 'checkin') {
    iconEmoji = '🆘';
    iconTitle = 'Check-in';
  } else {
    iconEmoji = getMarkerEmoji(icon_type);
  }

  const handleClick = useCallback(() => {
    if (!isEditing) {
      onSelect(feature.id);
    }
  }, [isEditing, feature.id, onSelect]);

  const handleEnterEditMode = useCallback((e) => {
    e.stopPropagation();
    if (!readOnly) {
      setEditedName(name || '');
      setIsEditing(true);
    }
  }, [readOnly, name]);

  const handleEditTime = useCallback((e) => {
    e.stopPropagation();
    if (!readOnly) {
      setEditedName(name || '');
      setIsEditing(true);
    }
  }, [readOnly, name]);

  const handleSaveTime = useCallback((newArrival, newDuration) => {
    const arrivalChanged = newArrival !== estimated_arrival;
    
    // If arrival time changed and we have cascade capability + subsequent checkpoints
    if (arrivalChanged && onUpdateWithCascade && hasSubsequentCheckpoints) {
      // Store the pending change and show cascade prompt
      setPendingTimeChange({ newArrival, newDuration });
    } else {
      // Direct update without cascade
      onUpdate(feature.id, {
        properties: {
          ...feature.properties,
          name: editedName,
          estimated_arrival: newArrival,
          estimated_duration_minutes: newDuration,
        },
      });
      setIsEditing(false);
    }
  }, [feature.id, feature.properties, editedName, estimated_arrival, onUpdate, onUpdateWithCascade, hasSubsequentCheckpoints]);

  const handleCascadeConfirm = useCallback((shouldCascade) => {
    if (!pendingTimeChange) return;
    
    const { newArrival, newDuration } = pendingTimeChange;
    
    if (shouldCascade && onUpdateWithCascade) {
      // Use cascade update
      onUpdateWithCascade(feature.id, {
        properties: {
          ...feature.properties,
          name: editedName,
          estimated_arrival: newArrival,
          estimated_duration_minutes: newDuration,
        },
      });
    } else {
      // Regular update
      onUpdate(feature.id, {
        properties: {
          ...feature.properties,
          name: editedName,
          estimated_arrival: newArrival,
          estimated_duration_minutes: newDuration,
        },
      });
    }
    
    setPendingTimeChange(null);
    setIsEditing(false);
  }, [feature.id, feature.properties, editedName, pendingTimeChange, onUpdate, onUpdateWithCascade]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setPendingTimeChange(null);
  }, []);

  const handleCenterMap = useCallback((e) => {
    e.stopPropagation();
    if (onCenter && coordinates) {
      // Fix: Swap coordinates because GeoJSON is [Lon, Lat] but Leaflet expects [Lat, Lon]
      const [lon, lat] = coordinates;
      onCenter(feature.id, [lat, lon]);
    }
  }, [feature.id, coordinates, onCenter]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(feature.id);
    }
  }, [feature.id, onDelete]);

  // FE-06: Handle double-click to navigate (Legacy/Removed)
  // Now double-click triggers edit mode

  return (
    <div
      className={`checkpoint-item ${selected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleEnterEditMode}
    >
      {/* Icon */}
      <span className="checkpoint-icon" title={iconTitle}>
        {iconEmoji}
      </span>
      
      {/* Main content */}
      <div className="checkpoint-content">
        <span className="checkpoint-name">
          {name || 'Unnamed Checkpoint'}
        </span>
        
        {/* Coordinates Row with Navigate Button */}
        <div className="checkpoint-coords-row flex items-center gap-2 text-xs text-gray-500 mt-1">
            <span>{formattedCoords}</span>
            <button 
                className="nav-btn text-blue-500 hover:text-blue-700 p-1 rounded" 
                title="Navigate on map"
                onClick={handleCenterMap}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="22" y1="12" x2="18" y2="12"></line>
                    <line x1="6" y1="12" x2="2" y2="12"></line>
                    <line x1="12" y1="6" x2="12" y2="2"></line>
                    <line x1="12" y1="22" x2="12" y2="18"></line>
                </svg>
            </button>
        </div>
        
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
          <div className="checkpoint-edit-container">
            <input
              type="text"
              className="checkpoint-name-edit"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Checkpoint name"
              onClick={(e) => e.stopPropagation()}
              style={{ 
                width: '100%', 
                marginBottom: '8px', 
                padding: '4px', 
                border: '1px solid #ddd', 
                borderRadius: '4px' 
              }}
            />
            <CheckpointTimeEditor
              arrival={estimated_arrival}
              duration={estimated_duration_minutes}
              onSave={handleSaveTime}
              onCancel={handleCancelEdit}
            />
          </div>
        )}
        
        {/* Cascade prompt - shown when time change affects subsequent checkpoints */}
        {pendingTimeChange && (
          <div className="cascade-prompt" onClick={(e) => e.stopPropagation()}>
            <span className="cascade-prompt-text">
              Update subsequent checkpoint times?
            </span>
            <div className="cascade-prompt-actions">
              <button
                className="cascade-btn cascade-yes"
                onClick={() => handleCascadeConfirm(true)}
                title="Shift all subsequent checkpoint times by the same amount"
              >
                Yes, cascade
              </button>
              <button
                className="cascade-btn cascade-no"
                onClick={() => handleCascadeConfirm(false)}
                title="Only update this checkpoint"
              >
                No, this only
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      {!readOnly && (
        <div className="checkpoint-actions">
          {!isEditing && (
            <button 
              className="action-btn edit-time-btn"
              title="Edit" 
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
      semantic_type: PropTypes.string,
      hazard_subtype: PropTypes.string,
      estimated_arrival: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      estimated_duration_minutes: PropTypes.number,
    }),
  }).isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onUpdateWithCascade: PropTypes.func, // Optional: for cascade time updates
  onDelete: PropTypes.func,
  onCenter: PropTypes.func,
  readOnly: PropTypes.bool,
  hasSubsequentCheckpoints: PropTypes.bool, // Whether there are checkpoints after this one
};

CheckpointItem.defaultProps = {
  selected: false,
  readOnly: false,
  onDelete: null,
  onCenter: null,
  onUpdateWithCascade: null,
  hasSubsequentCheckpoints: false,
};

export default CheckpointItem;