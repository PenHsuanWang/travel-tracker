/**
 * AreaCard - Timeline card for Polygon (Area) features.
 * 
 * Displays area span with duration and hazard warnings.
 * Part of Unified Timeline Support.
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { formatDurationSimple } from '../../services/planService';
import { formatArea } from '../../utils/geoUtils';
import './ItineraryPanel.css';

const AreaCard = ({
  feature,
  selected,
  isScheduled,
  onSelect,
  onUpdate,
  onDelete,
  onNavigate,
  onEdit,
  readOnly,
}) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [durationValue, setDurationValue] = useState(feature.properties?.estimated_duration_minutes || 30);

  const {
    name,
    estimated_arrival,
    estimated_duration_minutes,
    notes,
    semantic_type,
    area_sq_m,
  } = feature.properties || {};

  const isHazard = semantic_type === 'hazard';
  const borderColor = isHazard ? 'border-red-500' : 'border-gray-400';
  const bgColor = isHazard ? 'bg-red-50' : 'bg-gray-50';
  const textColor = isHazard ? 'text-red-900' : 'text-gray-900';
  const noteColor = isHazard ? 'text-red-700' : 'text-gray-600';

  // Calculate End Time
  const getEndTime = () => {
    if (!estimated_arrival || !estimated_duration_minutes) return null;
    try {
      const start = new Date(estimated_arrival);
      const end = new Date(start.getTime() + estimated_duration_minutes * 60000);
      return format(end, 'HH:mm');
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
        onUpdate(feature.id, {
            properties: {
                ...feature.properties,
                estimated_arrival: null,
                estimated_duration_minutes: null
            }
        });
    } else {
        const now = new Date().toISOString();
        onUpdate(feature.id, {
            properties: {
                ...feature.properties,
                estimated_arrival: now,
                estimated_duration_minutes: 30 // Default 30m
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
      className={`timeline-card area-card border-l-4 ${borderColor} ${bgColor} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(feature.id)}
      onDoubleClick={() => onEdit && onEdit(feature.id)}
    >
      <div className="header flex justify-between items-start">
        <div className="flex items-center gap-2 overflow-hidden">
            <span>{isHazard ? '⚠️' : '⬠'}</span>
            <span className={`font-bold ${textColor} truncate`}>{name || 'Area'}</span>
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
                    className={`time-range text-sm font-mono ${textColor} cursor-pointer hover:bg-white/50 rounded px-1`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!readOnly) setIsEditingTime(true);
                    }}
                    title="Click to edit duration"
                >
                    {timeRange} 
                    {estimated_duration_minutes && <span className="text-xs ml-1 opacity-75">({formatDurationSimple(estimated_duration_minutes)})</span>}
                </div>
             )}
        </div>
      </div>

      <div className="stats text-xs text-gray-600 mt-1">
        {area_sq_m && <span>📐 {formatArea(area_sq_m)}</span>}
      </div>

      {notes && (
          <div className={`notes text-xs ${noteColor} mt-1`}>
            📝 {notes}
          </div>
      )}

      {!readOnly && (
          <div className="card-actions flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleToggleSchedule} title="Remove from schedule" className="text-xs mr-2">📅✕</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(feature.id); }} title="Delete" className="text-xs">🗑️</button>
          </div>
      )}
    </div>
  );
};

AreaCard.propTypes = {
  feature: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  isScheduled: PropTypes.bool,
  onSelect: PropTypes.func,
  onUpdate: PropTypes.func,
  onDelete: PropTypes.func,
  readOnly: PropTypes.bool,
};

export default AreaCard;
