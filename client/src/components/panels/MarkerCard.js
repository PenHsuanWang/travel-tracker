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
  } = feature.properties || {};
  
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
      className={`marker-card ${selected ? 'marker-card--selected' : ''} ${isScheduled ? 'marker-card--scheduled' : 'marker-card--reference'}`}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className="marker-card__icon" title={iconConfig.label}>
        <span>{iconConfig.emoji}</span>
      </div>
      
      {/* Content */}
      <div className="marker-card__content">
        {/* Name */}
        <div className="marker-card__name">
          {name || iconConfig.label || 'Marker'}
        </div>
        
        {/* GPS Coordinates - ALWAYS VISIBLE (PRD FR-3.4) */}
        <div className="marker-card__coords">
          <span className="marker-card__coords-icon">📍</span>
          <span className="marker-card__coords-text">{coordsDisplay || 'No coordinates'}</span>
          <button 
            className="marker-card__nav-btn"
            onClick={handleNavigate}
            title="Center map on this location"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="22" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="12" x2="2" y2="12"/>
              <line x1="12" y1="6" x2="12" y2="2"/>
              <line x1="12" y1="22" x2="12" y2="18"/>
            </svg>
          </button>
        </div>
        
        {/* Time Row (for scheduled items) */}
        {isScheduled && estimated_arrival && !isEditingTime && (
          <div className="marker-card__time">
            <span className="marker-card__time-icon">🕐</span>
            <span className="marker-card__time-absolute">
              {formatArrivalTime(estimated_arrival)}
            </span>
            {deltaTime && (
              <span className="marker-card__time-delta">({deltaTime})</span>
            )}
            {estimated_duration_minutes && (
              <span className="marker-card__time-duration">
                • {formatDuration(estimated_duration_minutes)}
              </span>
            )}
          </div>
        )}
        
        {/* Time Editor */}
        {isEditingTime && (
          <div className="marker-card__time-editor" onClick={(e) => e.stopPropagation()}>
            <input
              type="datetime-local"
              value={timeInputValue}
              onChange={(e) => setTimeInputValue(e.target.value)}
              autoFocus
            />
            <button className="btn-save" onClick={handleSaveTime}>✓</button>
            <button className="btn-cancel" onClick={() => setIsEditingTime(false)}>✕</button>
          </div>
        )}
      </div>
      
      {/* Actions */}
      {!readOnly && (
        <div className="marker-card__actions">
          {/* Schedule Toggle */}
          <button
            className={`marker-card__schedule-btn ${isScheduled ? 'is-scheduled' : ''}`}
            onClick={handleToggleSchedule}
            title={isScheduled ? 'Remove from schedule' : 'Add to schedule'}
          >
            {isScheduled ? '📅✓' : '📅+'}
          </button>
          
          {/* Delete */}
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
