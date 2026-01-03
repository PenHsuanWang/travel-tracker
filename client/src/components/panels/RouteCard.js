/**
 * RouteCard - Timeline card for Route (LineString) features.
 * 
 * Displays route span with duration, distance, and elevation stats.
 * Part of Unified Timeline Support.
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { formatArrivalTime, formatDurationSimple } from '../../services/planService';
import './ItineraryPanel.css'; // Assuming styles are here or global

const RouteCard = ({
  feature,
  selected,
  isScheduled,
  onSelect,
  onUpdate,
  onDelete,
  onNavigate,
  onEdit, // Double click to edit props
  readOnly,
}) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [durationValue, setDurationValue] = useState(feature.properties?.estimated_duration_minutes || 60);

  const {
    name,
    estimated_arrival,
    estimated_duration_minutes,
    distance_km,
    elevation_gain_m,
    elevation_loss_m,
  } = feature.properties || {};

  // Calculate End Time
  const getEndTime = () => {
    if (!estimated_arrival || !estimated_duration_minutes) return null;
    try {
      const start = new Date(estimated_arrival);
      const end = new Date(start.getTime() + estimated_duration_minutes * 60000);
      return format(end, 'HH:mm'); // Just time for end
    } catch {
      return null;
    }
  };

  const startTimeStr = estimated_arrival ? format(new Date(estimated_arrival), 'HH:mm') : '';
  const endTimeStr = getEndTime();
  const timeRange = startTimeStr && endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;

  const handleToggleSchedule = useCallback((e) => {
    e.stopPropagation();
    if (isScheduled) {
        // Remove from schedule
        onUpdate(feature.id, {
            properties: {
                ...feature.properties,
                estimated_arrival: null,
                estimated_duration_minutes: null
            }
        });
    } else {
        // Add to schedule logic should probably happen via a dialog or defaults
        // For now, we assume if it's rendered as RouteCard it might be scheduled or we want to schedule it.
        // But if isScheduled is false, it's in the reference list.
        // We'll let the parent handle the "Add to Timeline" action which usually involves setting a time.
        // But here we implement the button similar to MarkerCard.
        const now = new Date().toISOString();
        onUpdate(feature.id, {
            properties: {
                ...feature.properties,
                estimated_arrival: now,
                estimated_duration_minutes: 60 // Default 1h
            }
        });
    }
  }, [isScheduled, feature.id, feature.properties, onUpdate]);

  const handleDurationChange = (e) => {
      setDurationValue(parseInt(e.target.value) || 0);
  };

  const saveDuration = (e) => {
      e.stopPropagation();
      onUpdate(feature.id, {
          properties: {
              ...feature.properties,
              estimated_duration_minutes: durationValue
          }
      });
      setIsEditingTime(false);
  };

  return (
    <div 
      className={`timeline-card route-card border-l-4 border-indigo-400 bg-indigo-50 ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(feature.id)}
      onDoubleClick={() => onEdit && onEdit(feature.id)}
    >
      <div className="header flex justify-between items-start">
        <div className="flex items-center gap-2 overflow-hidden">
            <span>〰️</span>
            <span className="font-bold text-indigo-900 truncate">{name || 'Route'}</span>
        </div>
        
        <div className="text-right flex-shrink-0">
             {isEditingTime ? (
                 <div className="flex items-center bg-white p-1 rounded shadow" onClick={e => e.stopPropagation()}>
                     <input 
                        type="number" 
                        className="w-12 text-xs border rounded px-1" 
                        value={durationValue} 
                        onChange={handleDurationChange}
                        placeholder="min"
                     />
                     <span className="text-xs ml-1">min</span>
                     <button className="ml-1 text-green-600 font-bold" onClick={saveDuration}>✓</button>
                 </div>
             ) : (
                <div 
                    className="time-range text-sm font-mono text-indigo-700 cursor-pointer hover:bg-indigo-100 rounded px-1"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!readOnly) setIsEditingTime(true);
                    }}
                    title="Click to edit duration"
                >
                    {timeRange} 
                    {estimated_duration_minutes && <span className="text-xs ml-1 text-gray-500">({formatDurationSimple(estimated_duration_minutes)})</span>}
                </div>
             )}
        </div>
      </div>

      <div className="stats text-xs text-gray-600 mt-1 flex gap-3">
        {distance_km && <span>📏 {parseFloat(distance_km).toFixed(1)} km</span>}
        {elevation_gain_m && <span>⬆️ {Math.round(elevation_gain_m)}m</span>}
        {elevation_loss_m && <span>⬇️ {Math.round(elevation_loss_m)}m</span>}
      </div>

      {!readOnly && (
          <div className="card-actions flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleToggleSchedule} title="Remove from schedule" className="text-xs mr-2">📅✕</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(feature.id); }} title="Delete" className="text-xs">🗑️</button>
          </div>
      )}
    </div>
  );
};

RouteCard.propTypes = {
  feature: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  isScheduled: PropTypes.bool,
  onSelect: PropTypes.func,
  onUpdate: PropTypes.func,
  onDelete: PropTypes.func,
  readOnly: PropTypes.bool,
};

export default RouteCard;
