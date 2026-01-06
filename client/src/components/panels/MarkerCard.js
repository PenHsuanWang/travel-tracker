// client/src/components/panels/MarkerCard.js
/**
 * MarkerCard - Unified card component for displaying map markers.
 * Refactored to use Card component and context-aware theming.
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { Card, CardBody } from '../common/Card/Card';
import { formatCoordinates, formatArrivalTime } from '../../services/planService';
import { ICON_CONFIG } from '../../utils/mapIcons';

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
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  
  const {
    name,
    semantic_type,
    hazard_subtype,
    estimated_arrival,
    note,
    notes,
  } = feature.properties || {};

  const displayNote = notes || note;
  const coordinates = feature.geometry?.coordinates;
  const coordsDisplay = formatCoordinates(coordinates);
  
  const getIconConfig = () => {
    if (hazard_subtype === 'river_tracing') return { emoji: '🌊', label: 'River Tracing' };
    if (hazard_subtype === 'rock_climbing') return { emoji: '🧗', label: 'Rock Climbing' };
    if (semantic_type && ICON_CONFIG[semantic_type]) return ICON_CONFIG[semantic_type];
    return ICON_CONFIG.generic;
  };
  
  const iconConfig = getIconConfig();
  
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
  
  const handleClick = useCallback(() => {
    onSelect(feature.id);
  }, [feature.id, onSelect]);

  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setNameInput(name || '');
    setNoteInput(displayNote || '');
    setIsEditingCard(true);
    if (onEdit) onEdit(feature.id);
  }, [feature.id, onEdit, name, displayNote]);
  
  const handleNavigate = useCallback((e) => {
    e.stopPropagation();
    if (coordinates && onNavigate) {
      const [lon, lat] = coordinates;
      onNavigate(feature.id, [lat, lon]);
    }
  }, [feature.id, coordinates, onNavigate]);
  
  const handleToggleSchedule = useCallback((e) => {
    e.stopPropagation();
    if (isScheduled) {
      const existing = feature.properties?.estimated_arrival;
      if (existing) {
        setTimeInputValue(format(new Date(existing), "yyyy-MM-dd'T'HH:mm"));
      } else {
        const now = new Date();
        setTimeInputValue(format(now, "yyyy-MM-dd'T'HH:mm"));
      }
      setIsEditingTime(true);
    } else {
      setIsEditingTime(true);
      const now = new Date();
      setTimeInputValue(format(now, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [isScheduled, feature.id, feature.properties, onUpdate]);
  
  const handleSaveTime = useCallback(() => {
    if (!timeInputValue) {
      setIsEditingTime(false);
      return;
    }
    const newArrival = new Date(timeInputValue).toISOString();
    onUpdate(feature.id, {
      properties: { ...feature.properties, estimated_arrival: newArrival },
    });
    setIsEditingTime(false);
  }, [timeInputValue, feature.id, feature.properties, onUpdate]);
  
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (onDelete) onDelete(feature.id);
  }, [feature.id, onDelete]);

  // Determine border color style based on status
  // Scheduled = Brand color (Green/Blue depending on theme), Reference = Gray
  // Note: We use style prop for border-color to leverage theme variables if needed, or classes
  const statusBorderClass = isScheduled ? 'border-l-4 border-[var(--color-brand)]' : 'border-l-4 border-slate-300';

  return (
    <Card 
      variant="plan"
      selected={selected}
      className={`group mb-2 ${statusBorderClass}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <CardBody className="p-3">
        {/* ROW 1: Header */}
        <div className="flex justify-between items-start w-full gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-md text-lg" title={iconConfig.label}>
              <span>{iconConfig.emoji}</span>
            </div>
            {isEditingCard ? (
              <input
                className="font-bold text-slate-900 truncate border-b border-[var(--color-brand)] outline-none bg-transparent w-full"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h4 className="font-bold text-slate-900 truncate">
                {name || iconConfig.label || 'Marker'}
              </h4>
            )}
          </div>
          
          <div className="text-right flex-shrink-0">
              {isEditingTime ? (
                <div className="flex items-center gap-1 bg-white shadow-sm p-1 rounded border border-slate-200" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="datetime-local"
                    value={timeInputValue}
                    onChange={(e) => setTimeInputValue(e.target.value)}
                    autoFocus
                    className="text-xs p-1 border rounded w-32"
                  />
                  <button className="text-green-600 font-bold px-1" onClick={handleSaveTime}>✓</button>
                  <button className="text-slate-400 px-1" onClick={() => setIsEditingTime(false)}>✕</button>
                  <button
                    className="text-red-500 text-xs px-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(feature.id, {
                        properties: { ...feature.properties, estimated_arrival: null, estimated_duration_minutes: null },
                      });
                      setIsEditingTime(false);
                    }}
                    title="Remove scheduled time"
                  >Del</button>
                </div>
              ) : (
                  isScheduled && estimated_arrival && (
                      <div className="flex flex-col items-end">
                        <div className="font-mono font-bold text-[var(--color-brand)] whitespace-nowrap text-sm">
                          {formatArrivalTime(estimated_arrival)}
                        </div>
                        {deltaTime && (
                          <div className="text-xs text-slate-400 whitespace-nowrap">
                            {deltaTime}
                          </div>
                        )}
                      </div>
                  )
              )}
          </div>
        </div>

        {/* ROW 2: Notes (Conditional) */}
        {isEditingCard ? (
          <div className="mt-2 pl-10 w-full" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="w-full text-sm border rounded p-2 focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)]"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={2}
              placeholder="Add notes..."
            />
            <div className="mt-2 flex gap-2 justify-end">
              <button
                className="px-2 py-1 text-xs bg-[var(--color-brand)] text-white rounded hover:opacity-90"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(feature.id, {
                    properties: { ...feature.properties, name: nameInput, notes: noteInput },
                  });
                  setIsEditingCard(false);
                }}
              >Save</button>
              <button
                className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                onClick={(e) => { e.stopPropagation(); setIsEditingCard(false); }}
              >Cancel</button>
            </div>
          </div>
        ) : (
          displayNote && (
            <div className="mt-2 mb-2 pl-10 w-full">
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 p-2 rounded leading-snug break-words">
                <span className="mr-1">📝</span>
                {displayNote}
              </div>
            </div>
          )
        )}

        {/* ROW 3: Footer */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 pl-10 w-full">
          <div 
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-[var(--color-brand)] cursor-pointer transition-colors"
            onClick={handleNavigate}
            title="Center map on this location"
          >
            <span>📍</span>
            <span className="font-mono">{coordsDisplay || 'No coordinates'}</span>
          </div>
          
          {/* Actions */}
          {!readOnly && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className={`p-1 rounded text-xs border ${isScheduled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-transparent border-slate-200 text-slate-400 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)]'}`}
                onClick={handleToggleSchedule}
                title={isScheduled ? 'Remove from schedule' : 'Add to schedule'}
              >
                {isScheduled ? '📅✓' : '📅+'}
              </button>
              
              <button
                className="p-1 rounded text-xs border border-transparent hover:bg-red-50 hover:text-red-500 hover:border-red-200 text-slate-400"
                onClick={handleDelete}
                title="Delete marker"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

MarkerCard.propTypes = {
  feature: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  isScheduled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  readOnly: PropTypes.bool,
};

export default MarkerCard;
