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
  const [dateValue, setDateValue] = useState('');
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const {
    name,
    estimated_arrival,
    estimated_duration_minutes,
    distance_km,
    elevation_gain_m,
    elevation_loss_m,
    description,
    notes,
  } = feature.properties || {};

  // For Route (non-point) features we treat schedule as date-granularity.
  // Display only the scheduled date (no duration shown in card header)
  const startDateStr = estimated_arrival ? format(new Date(estimated_arrival), 'MMM d') : '';

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
      const today = new Date();
      const isoDateMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      onUpdate(feature.id, {
        properties: {
          ...feature.properties,
          estimated_arrival: isoDateMidnight,
          estimated_duration_minutes: 60 // Default 1h
        }
      });
    }
  }, [isScheduled, feature.id, feature.properties, onUpdate]);

  const handleDurationChange = (e) => {
      setDurationValue(parseInt(e.target.value) || 0);
  };

  const handleDateChange = (e) => {
      setDateValue(e.target.value);
  };

  const saveDateTime = (e) => {
      e.stopPropagation();
      // 使用dateValue（如果已修改）或當前estimated_arrival
      const finalDate = dateValue || (estimated_arrival ? format(new Date(estimated_arrival), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      const iso = new Date(finalDate + 'T00:00:00').toISOString();
      onUpdate(feature.id, {
          properties: {
              ...feature.properties,
              estimated_arrival: iso,
              estimated_duration_minutes: durationValue
          }
      });
      setIsEditingTime(false);
      setDateValue(''); // 清空暫存
  };

  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setNameInput(name || '');
    setDescInput(notes || description || '');
    setIsEditingCard(true);
  }, [name, notes, description]);

  const handleSaveCard = useCallback((e) => {
    e.stopPropagation();
    onUpdate(feature.id, {
      properties: {
        ...feature.properties,
        name: nameInput,
        notes: descInput,
      }
    });
    setIsEditingCard(false);
  }, [feature.id, feature.properties, nameInput, descInput, onUpdate]);

  const handleCancelCard = useCallback((e) => {
    e.stopPropagation();
    setIsEditingCard(false);
  }, []);

  return (
    <div 
      className={`timeline-card route-card border-l-4 border-indigo-400 bg-indigo-50 ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(feature.id)}
      onDoubleClick={handleDoubleClick}
    >
      <div className="header flex justify-between items-start">
        <div className="flex items-center gap-2 overflow-hidden">
            <span>〰️</span>
            {isEditingCard ? (
              <input
                type="text"
                className="font-bold text-indigo-900 truncate border-b border-indigo-300 bg-transparent px-1"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="font-bold text-indigo-900 truncate">{name || 'Route'}</span>
            )}
        </div>
        
        <div className="text-right flex-shrink-0">
             {isEditingTime ? (
               <div className="flex items-center bg-white p-1 rounded shadow" onClick={e => e.stopPropagation()}>
                 <input
                   type="date"
                   className="text-xs p-1 border rounded"
                   value={dateValue || (estimated_arrival ? format(new Date(estimated_arrival), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))}
                   onChange={handleDateChange}
                 />
                 <button className="ml-1 text-green-600 font-bold" onClick={saveDateTime}>✓</button>
               </div>
             ) : (
              <div 
                className="time-range text-sm font-mono text-indigo-700 cursor-pointer hover:bg-indigo-100 rounded px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) setIsEditingTime(true);
                }}
                title="Click to edit date"
              >
                {startDateStr}
              </div>
             )}
        </div>
      </div>

      <div className="stats text-xs text-gray-600 mt-1 flex gap-3">
        {distance_km && <span>📏 {parseFloat(distance_km).toFixed(1)} km</span>}
        {elevation_gain_m && <span>⬆️ {Math.round(elevation_gain_m)}m</span>}
        {elevation_loss_m && <span>⬇️ {Math.round(elevation_loss_m)}m</span>}
      </div>

      {isEditingCard && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="w-full text-xs border rounded p-2 bg-white"
            placeholder="Description (optional)"
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              onClick={handleSaveCard}
            >
              Save
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
              onClick={handleCancelCard}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isEditingCard && (notes || description) && (
        <div className="text-xs text-gray-600 mt-1 px-1">
          📝 {notes || description}
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
