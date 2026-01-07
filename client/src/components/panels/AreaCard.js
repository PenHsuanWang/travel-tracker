/**
 * AreaCard - Timeline card for Polygon (Area) features.
 * 
 * Displays area span with duration and hazard warnings.
 * Part of Unified Timeline Support.
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { Card, CardBody } from '../common/Card/Card';
import { formatDurationSimple } from '../../services/planService';
import { getImageUrl } from '../../services/api';
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
  members,
}) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [durationValue, setDurationValue] = useState(feature.properties?.estimated_duration_minutes || 30);
  const [dateValue, setDateValue] = useState('');
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const creator = members?.find(m => String(m.id) === String(feature.properties?.created_by));

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
  const bgColor = isHazard ? 'bg-red-50' : ''; 
  const textColor = isHazard ? 'text-red-900' : 'text-slate-900';
  const noteColor = isHazard ? 'text-red-700' : 'text-slate-600';

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
          estimated_duration_minutes: 30
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
      className={`mb-2 border-l-4 ${borderColor} ${bgColor} group`}
      onClick={() => onSelect(feature.id)}
      onDoubleClick={handleDoubleClick}
    >
      <CardBody className="p-3">
        <div className="flex justify-between items-start w-full gap-2">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
              <span className="text-lg">{isHazard ? '⚠️' : '⬠'}</span>
              {isEditingCard ? (
                <input
                  type="text"
                  className={`font-bold ${textColor} truncate border-b ${isHazard ? 'border-red-300' : 'border-[var(--color-brand)]'} outline-none bg-transparent w-full`}
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
                  className={`time-range text-sm font-mono ${textColor} cursor-pointer hover:bg-white/50 rounded px-1`}
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

        <div className="text-xs text-slate-500 mt-2">
          {area_sq_m && <span>📐 {formatArea(area_sq_m)}</span>}
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
          <div className={`mt-2 text-xs ${noteColor} bg-white/50 border border-transparent p-2 rounded`}>
            📝 {notes || description}
          </div>
        )}

        {!readOnly && (
            <div className="flex justify-end mt-2 pt-2 border-t border-slate-200/50 opacity-0 group-hover:opacity-100 transition-opacity gap-2 items-center">
                {creator && (
                    <img 
                        src={creator.avatar_url ? (creator.avatar_url.startsWith('http') ? creator.avatar_url : getImageUrl(creator.avatar_url)) : '/default-avatar.svg'} 
                        alt={creator.username}
                        title={`Created by ${creator.username}`}
                        className="w-4 h-4 rounded-full border border-white shadow-sm mr-auto"
                    />
                )}
                <button 
                  onClick={handleToggleSchedule} 
                  title="Remove from schedule" 
                  className="p-1 rounded text-xs bg-white/80 border border-slate-200 text-slate-500 hover:text-red-500"
                >
                  📅✕
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(feature.id); }} 
                  title="Delete" 
                  className="p-1 rounded text-xs bg-white/80 border border-slate-200 text-slate-500 hover:text-red-500"
                >
                  🗑️
                </button>
            </div>
        )}
      </CardBody>
    </Card>
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
