// client/src/components/panels/CheckpointTimeEditor.js
/**
 * CheckpointTimeEditor - Inline editor for checkpoint arrival time and duration.
 * 
 * This component provides:
 * - datetime-local input for arrival time
 * - number input for duration in minutes
 * - Save/Cancel buttons
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './CheckpointTimeEditor.css';

/**
 * Convert ISO datetime string to datetime-local input format (YYYY-MM-DDTHH:mm)
 */
const toDatetimeLocalValue = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // Get local time components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

/**
 * Convert datetime-local input value to ISO string
 */
const toISOString = (datetimeLocalValue) => {
  if (!datetimeLocalValue) return null;
  try {
    const date = new Date(datetimeLocalValue);
    return date.toISOString();
  } catch {
    return null;
  }
};

const CheckpointTimeEditor = ({
  arrival,
  duration,
  onSave,
  onCancel,
}) => {
  const [newArrival, setNewArrival] = useState(() => toDatetimeLocalValue(arrival));
  const [newDuration, setNewDuration] = useState(duration || '');
  const arrivalInputRef = useRef(null);

  // Focus the arrival input when mounted
  useEffect(() => {
    if (arrivalInputRef.current) {
      arrivalInputRef.current.focus();
    }
  }, []);

  const handleArrivalChange = useCallback((e) => {
    setNewArrival(e.target.value);
  }, []);

  const handleDurationChange = useCallback((e) => {
    const value = e.target.value;
    // Allow empty or positive integers
    if (value === '' || /^\d+$/.test(value)) {
      setNewDuration(value === '' ? '' : parseInt(value, 10));
    }
  }, []);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    const isoArrival = toISOString(newArrival);
    const durationValue = typeof newDuration === 'number' && newDuration > 0 ? newDuration : null;
    onSave(isoArrival, durationValue);
  }, [newArrival, newDuration, onSave]);

  const handleCancel = useCallback((e) => {
    e.stopPropagation();
    onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSave(e);
    } else if (e.key === 'Escape') {
      handleCancel(e);
    }
  }, [handleSave, handleCancel]);

  return (
    <div 
      className="checkpoint-time-editor" 
      onClick={(e) => e.stopPropagation()}
    >
      <div className="time-field">
        <label htmlFor="arrival-input">Arrival</label>
        <input
          ref={arrivalInputRef}
          id="arrival-input"
          type="datetime-local"
          value={newArrival}
          onChange={handleArrivalChange}
          onKeyDown={handleKeyDown}
          className="datetime-input"
        />
      </div>
      
      <div className="duration-field">
        <label htmlFor="duration-input">Duration (min)</label>
        <input
          id="duration-input"
          type="number"
          min="0"
          step="5"
          value={newDuration}
          onChange={handleDurationChange}
          onKeyDown={handleKeyDown}
          placeholder="Optional"
          className="duration-input"
        />
      </div>
      
      <div className="editor-actions">
        <button 
          type="button"
          className="save-btn"
          onClick={handleSave}
          title="Save (Enter)"
        >
          ✅ Save
        </button>
        <button 
          type="button"
          className="cancel-btn"
          onClick={handleCancel}
          title="Cancel (Escape)"
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  );
};

CheckpointTimeEditor.propTypes = {
  arrival: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  duration: PropTypes.number,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

CheckpointTimeEditor.defaultProps = {
  arrival: null,
  duration: null,
};

export default CheckpointTimeEditor;
