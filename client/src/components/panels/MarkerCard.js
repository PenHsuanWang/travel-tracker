// client/src/components/panels/MarkerCard.js
/**
 * MarkerCard - Unified card component for displaying map markers.
 * 
 * Part of the Unified Marker System (PRD v1.1).
 * This component renders both Timeline items (with time) and 
 * Reference items (without time) in the ItineraryPanel.
 * 
 * Features:
 * - Semantic icon display based on type
 * - GPS coordinates always visible (PRD FR-3.4)
 * - Time information for scheduled items
 * - Toggle to add/remove from schedule
 * - Navigate button to center map
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { formatCoordinates, formatArrivalTime, formatDuration } from '../../services/planService';
import { ICON_CONFIG } from '../../utils/mapIcons';
import './MarkerCard.css';

const MarkerCard = ({
  feature,
  selected,
  isScheduled,
  onSelect,
  onUpdate,
  onUpdateWithCascade,
  onDelete,
  onNavigate,
  onEdit,
  readOnly,
  showDeltaTime,
  previousArrival,
  hasSubsequentItems,
}) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState('');
  
  const {
    name,
    semantic_type,
    hazard_subtype,
    estimated_arrival,
    estimated_duration_minutes,
    note,
    notes,
  } = feature.properties || {};

  const displayNote = notes || note;
  
  const coordinates = feature.geometry?.coordinates;
  
  // Format coordinates for display: "lat, lon"
  const coordsDisplay = formatCoordinates(coordinates);
  
  // Get semantic icon configuration
  const getIconConfig = () => {
    // Priority 1: Hazard subtypes
    if (hazard_subtype === 'river_tracing') {
      return { emoji: '🌊', label: 'River Tracing' };
    }
    if (hazard_subtype === 'rock_climbing') {
      return { emoji: '🧗', label: 'Rock Climbing' };
    }
    // Priority 2: Semantic type
    if (semantic_type && ICON_CONFIG[semantic_type]) {
      return ICON_CONFIG[semantic_type];
    }
    // Default
    return ICON_CONFIG.generic;
  };
  
  const iconConfig = getIconConfig();
  
  // Calculate delta time from previous item
  const getDeltaTime = () => {
    if (!showDeltaTime || !previousArrival || !estimated_arrival) return null;
    try {
      const prev = new Date(previousArrival);
      const curr = new Date(estimated_arrival);
      const diffMs = curr - prev;
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 0) return null;
      if (diffMins < 60) return `+${diffMins}m`;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return mins > 0 ? `+${hours}h${mins}m` : `+${hours}h`;
    } catch {
      return null;
    }
  };
  
  const deltaTime = getDeltaTime();
  
  // Handle click
  const handleClick = useCallback(() => {
    onSelect(feature.id);
  }, [feature.id, onSelect]);

  // Handle double click
  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    if (onEdit) {
      onEdit(feature.id);
    }
  }, [feature.id, onEdit]);
  
  // Handle navigate to map
  const handleNavigate = useCallback((e) => {
    e.stopPropagation();
    if (coordinates && onNavigate) {
      const [lon, lat] = coordinates;
      onNavigate(feature.id, [lat, lon]);
    }
  }, [feature.id, coordinates, onNavigate]);
  
  // Handle schedule toggle
  const handleToggleSchedule = useCallback((e) => {
    e.stopPropagation();
    if (isScheduled) {
      // Remove from schedule - clear time
      onUpdate(feature.id, {
        properties: {
          ...feature.properties,
          estimated_arrival: null,
          estimated_duration_minutes: null,
        },
      });
    } else {
      // Add to schedule - show time picker
      setIsEditingTime(true);
      // Default to now for convenience
      const now = new Date();
      setTimeInputValue(format(now, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [isScheduled, feature.id, feature.properties, onUpdate]);
  
  // Handle time save
  const handleSaveTime = useCallback(() => {
    if (!timeInputValue) {
      setIsEditingTime(false);
      return;
    }
    
    const newArrival = new Date(timeInputValue).toISOString();
    
    onUpdate(feature.id, {
      properties: {
        ...feature.properties,
        estimated_arrival: newArrival,
      },
    });
    
    setIsEditingTime(false);
  }, [timeInputValue, feature.id, feature.properties, onUpdate]);
  
  // Handle delete
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(feature.id);
    }
  }, [feature.id, onDelete]);

  return (
    <div 
      className={`marker-card group ${selected ? 'marker-card--selected' : ''} ${isScheduled ? 'marker-card--scheduled' : 'marker-card--reference'}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* ROW 1: Header */}
      <div className="marker-card__header flex justify-between items-start w-full gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="marker-card__icon flex-shrink-0" title={iconConfig.label}>
            <span>{iconConfig.emoji}</span>
          </div>
          <h4 className="marker-card__name font-bold text-gray-900 truncate">
            {name || iconConfig.label || 'Marker'}
          </h4>
        </div>
        
        <div className="text-right flex-shrink-0">
            {isEditingTime ? (
              <div className="marker-card__time-editor" onClick={(e) => e.stopPropagation()}>
                <input
                  type="datetime-local"
                  value={timeInputValue}
                  onChange={(e) => setTimeInputValue(e.target.value)}
                  autoFocus
                  className="text-xs p-1 border rounded"
                />
                <button className="btn-save ml-1" onClick={handleSaveTime}>✓</button>
                <button className="btn-cancel ml-1" onClick={() => setIsEditingTime(false)}>✕</button>
              </div>
            ) : (
                isScheduled && estimated_arrival && (
                    <div className="flex flex-col items-end">
                      <div className="marker-card__time-absolute font-mono font-bold text-blue-600 whitespace-nowrap">
                        {formatArrivalTime(estimated_arrival)}
                      </div>
                      {deltaTime && (
                        <div className="marker-card__time-delta text-xs text-gray-400 whitespace-nowrap">
                          {deltaTime}
                        </div>
                      )}
                    </div>
                )
            )}
        </div>
      </div>

      {/* ROW 2: Notes (Conditional) */}
      {displayNote && (
        <div className="marker-card__notes mt-2 mb-2 pl-8 w-full">
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 p-2 rounded leading-snug break-words">
            <span className="mr-1">📝</span>
            {displayNote}
          </div>
        </div>
      )}

      {/* ROW 3: Footer */}
      <div className="marker-card__footer flex justify-between items-center mt-1 pt-1 border-t border-gray-100 pl-8 w-full">
        <div 
          className="marker-card__coords flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 cursor-pointer"
          onClick={handleNavigate}
          title="Center map on this location"
        >
          <span className="marker-card__coords-icon">📍</span>
          <span className="font-mono">{coordsDisplay || 'No coordinates'}</span>
        </div>
        
        {/* Actions */}
        {!readOnly && (
          <div className="marker-card__actions opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            <button
              className={`marker-card__schedule-btn ${isScheduled ? 'is-scheduled' : ''}`}
              onClick={handleToggleSchedule}
              title={isScheduled ? 'Remove from schedule' : 'Add to schedule'}
            >
              {isScheduled ? '📅✓' : '📅+'}
            </button>
            
            <button
              className="marker-card__delete-btn"
              onClick={handleDelete}
              title="Delete marker"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

MarkerCard.propTypes = {
  feature: PropTypes.shape({
    id: PropTypes.string.isRequired,
    geometry: PropTypes.shape({
      type: PropTypes.string,
      coordinates: PropTypes.array,
    }),
    properties: PropTypes.object,
  }).isRequired,
  selected: PropTypes.bool,
  isScheduled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onUpdateWithCascade: PropTypes.func,
  onDelete: PropTypes.func,
  onNavigate: PropTypes.func,
  onEdit: PropTypes.func,
  readOnly: PropTypes.bool,
  showDeltaTime: PropTypes.bool,
  previousArrival: PropTypes.string,
  hasSubsequentItems: PropTypes.bool,
};

MarkerCard.defaultProps = {
  selected: false,
  isScheduled: false,
  readOnly: false,
  showDeltaTime: false,
  previousArrival: null,
  hasSubsequentItems: false,
};

export default MarkerCard;