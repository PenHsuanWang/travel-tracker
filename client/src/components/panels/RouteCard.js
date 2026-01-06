/**
 * RouteCard - Timeline card for Route (LineString) features.
 * 
 * Displays route span with duration, distance, and elevation stats.
 * Part of Unified Timeline Support.
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { Card, CardBody } from '../common/Card/Card';
import { formatArrivalTime, formatDurationSimple } from '../../services/planService';
import './ItineraryPanel.css'; 

const RouteCard = ({
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

  const startDateStr = estimated_arrival ? format(new Date(estimated_arrival), 'MMM d') : '';

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
          estimated_duration_minutes: 60 
        }
      });
    }
  }, [isScheduled, feature.id, feature.properties, onUpdate]);

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
    <Card 
      variant="plan"
      selected={selected}
      className="mb-2 border-l-4 border-indigo-400 group"
      onClick={() => onSelect(feature.id)}
      onDoubleClick={handleDoubleClick}
    >
      <CardBody className="p-3">
        <div className="flex justify-between items-start w-full gap-2">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
              <span className="text-lg">〰️</span>
              {isEditingCard ? (
                <input
                  type="text"
                  className="font-bold text-slate-900 truncate border-b border-[var(--color-brand)] outline-none bg-transparent w-full"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="font-bold text-slate-900 truncate">{name || 'Route'}</span>
              )}
          </div>
          
          <div className="text-right flex-shrink-0">
               {isEditingTime ? (
                 <div className="flex items-center bg-white p-1 rounded shadow border border-slate-200" onClick={e => e.stopPropagation()}>
                   <input
                     type="date"
                     className="text-xs p-1 border rounded"
                     value={dateValue || (estimated_arrival ? format(new Date(estimated_arrival), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))}
                     onChange={handleDateChange}
                   />
                   <button className="ml-1 text-green-600 font-bold px-1" onClick={saveDateTime}>✓</button>
                   <button className="text-slate-400 px-1" onClick={() => setIsEditingTime(false)}>✕</button>
                 </div>
               ) : (
                <div 
                  className="time-range text-sm font-mono text-[var(--color-brand)] cursor-pointer hover:bg-slate-100 rounded px-1"
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

        <div className="text-xs text-slate-500 mt-2 flex gap-3">
          {distance_km && <span className="flex items-center gap-1">📏 {parseFloat(distance_km).toFixed(1)} km</span>}
          {elevation_gain_m && <span className="flex items-center gap-1 text-green-600">⬆️ {Math.round(elevation_gain_m)}m</span>}
          {elevation_loss_m && <span className="flex items-center gap-1 text-red-500">⬇️ {Math.round(elevation_loss_m)}m</span>}
        </div>

        {isEditingCard && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="w-full text-xs border rounded p-2 focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)]"
              placeholder="Description (optional)"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                className="px-2 py-1 text-xs bg-[var(--color-brand)] text-white rounded hover:opacity-90"
                onClick={handleSaveCard}
              >
                Save
              </button>
              <button
                className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                onClick={handleCancelCard}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!isEditingCard && (notes || description) && (
          <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 p-2 rounded">
            📝 {notes || description}
          </div>
        )}

        {!readOnly && (
            <div className="flex justify-end mt-2 pt-2 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                <button 
                  onClick={handleToggleSchedule} 
                  title="Remove from schedule" 
                  className="p-1 rounded text-xs bg-green-50 border border-green-200 text-green-700"
                >
                  📅✕
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(feature.id); }} 
                  title="Delete" 
                  className="p-1 rounded text-xs border border-transparent hover:bg-red-50 hover:text-red-500 hover:border-red-200 text-slate-400"
                >
                  🗑️
                </button>
            </div>
        )}
      </CardBody>
    </Card>
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
