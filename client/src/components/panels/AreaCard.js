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
  const [dateValue, setDateValue] = useState('');
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const {
    name,
    estimated_arrival,
    estimated_duration_minutes,
    notes,
    semantic_type,
    area_sq_m,
    description,
  } = feature.properties || {};

  const isHazard = semantic_type === 'hazard';
  const borderColor = isHazard ? 'border-red-500' : 'border-gray-400';
  const bgColor = isHazard ? 'bg-red-50' : 'bg-gray-50';
  const textColor = isHazard ? 'text-red-900' : 'text-gray-900';
  const noteColor = isHazard ? 'text-red-700' : 'text-gray-600';

  // For Area (non-point) features use date-granularity scheduling.
  const startDateStr = estimated_arrival ? format(new Date(estimated_arrival), 'MMM d') : '';
  const durationDisplay = estimated_duration_minutes ? `(${formatDurationSimple(estimated_duration_minutes)})` : '';

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
      const today = new Date();
      const isoDateMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      onUpdate(feature.id, {
        properties: {
          ...feature.properties,
          estimated_arrival: isoDateMidnight,
          estimated_duration_minutes: 30
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
      setDateValue('');
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
      className={`timeline-card area-card border-l-4 ${borderColor} ${bgColor} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(feature.id)}
      onDoubleClick={handleDoubleClick}
    >
      <div className="header flex justify-between items-start">
        <div className="flex items-center gap-2 overflow-hidden">
            <span>{isHazard ? '⚠️' : '⬠'}</span>
            {isEditingCard ? (
              <input
                type="text"
                className={`font-bold ${textColor} truncate border-b ${isHazard ? 'border-red-300' : 'border-gray-300'} bg-transparent px-1`}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className={`font-bold ${textColor} truncate`}>{name || 'Area'}</span>
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
                 <input 
                  type="number" 
                  className="w-16 text-xs border rounded px-1 ml-2" 
                  value={durationValue} 
                  onChange={handleDurationChange}
                  placeholder="duration min"
                 />
                 <button className="ml-1 text-green-600 font-bold" onClick={saveDateTime}>✓</button>
               </div>
             ) : (
              <div 
                className={`time-range text-sm font-mono ${textColor} cursor-pointer hover:bg-white/50 rounded px-1`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) setIsEditingTime(true);
                }}
                title="Click to edit date/duration"
              >
                {startDateStr} 
                {durationDisplay && <span className="text-xs ml-1 opacity-75">{durationDisplay}</span>}
              </div>
             )}
        </div>
      </div>

      <div className="stats text-xs text-gray-600 mt-1">
        {area_sq_m && <span>📐 {formatArea(area_sq_m)}</span>}
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
        <div className={`notes text-xs ${noteColor} mt-1`}>
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
