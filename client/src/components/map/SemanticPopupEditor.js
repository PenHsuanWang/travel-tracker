// client/src/components/map/SemanticPopupEditor.js
/**
 * SemanticPopupEditor - Category-aware inline editor for feature properties.
 * 
 * This component is rendered inside Leaflet popups when a feature marker is clicked.
 * It provides:
 * - Category badge (read-only)
 * - Coordinates display for Point features
 * - Name input
 * - Icon selector (for waypoint/marker categories)
 * - Time fields (only for waypoint category)
 * - Color picker
 * - Notes textarea
 */
import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  FEATURE_CATEGORY,
  SEMANTIC_TYPE,
  MARKER_ICON_TYPES,
  getCategoryLabel,
  getCategoryIcon,
  categoryAllowsTime,
  formatCoordinates,
} from '../../services/planService';
import './SemanticPopupEditor.css';

const HAZARD_TYPES = [
  { value: 'other', label: 'Other', icon: '⚠️' },
  { value: 'river_tracing', label: 'River Tracing', icon: '🌊' },
  { value: 'rock_climbing', label: 'Rock Climbing', icon: '🧗' },
];

const RIVER_TRACING_GRADES = [
  { value: 'Class A', label: 'Class A (Novice)' },
  { value: 'Class B', label: 'Class B (Challenge)' },
  { value: 'Class C', label: 'Class C (Advanced)' },
  { value: 'Class D', label: 'Class D (Expert)' },
];

const ROCK_CLIMBING_GRADES = [
  { value: 'Novice', label: 'Novice (5.5-5.8)' },
  { value: 'Intermediate', label: 'Intermediate (5.9)' },
  { value: 'Advanced', label: 'Advanced (5.10)' },
  { value: 'Expert', label: 'Expert (5.11)' },
  { value: 'Elite', label: 'Elite (5.12+)' },
];

/**
 * Convert datetime to datetime-local input format
 */
const toDatetimeLocalValue = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
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

const SemanticPopupEditor = ({
  feature,
  onUpdate,
  onClose,
  onDelete,
  readOnly,
}) => {
  const { 
    category, 
    semantic_type,
    name, 
    notes, 
    icon_type, 
    color, 
    estimated_arrival, 
    estimated_duration_minutes,
    hazard_subtype,
    difficulty_grade 
  } = feature.properties || {};
  
  const isWaypoint = category === FEATURE_CATEGORY.WAYPOINT;
  const isPointCategory = [FEATURE_CATEGORY.WAYPOINT, FEATURE_CATEGORY.MARKER].includes(category);
  const isHazard = semantic_type === SEMANTIC_TYPE.HAZARD;
  
  // Extract coordinates for display
  const coordinates = feature.geometry?.coordinates;
  const isPoint = feature.geometry?.type === 'Point';
  
  // Form state
  const [formName, setFormName] = useState(name || '');
  const [formNotes, setFormNotes] = useState(notes || '');
  const [formIconType, setFormIconType] = useState(icon_type || '');
  const [formColor, setFormColor] = useState(color || '#3388ff');
  const [formArrival, setFormArrival] = useState(() => toDatetimeLocalValue(estimated_arrival));
  const [formDuration, setFormDuration] = useState(estimated_duration_minutes || '');
  const [formHazardSubtype, setFormHazardSubtype] = useState(hazard_subtype || 'other');
  const [formDifficultyGrade, setFormDifficultyGrade] = useState(difficulty_grade || '');
  
  const [isDirty, setIsDirty] = useState(false);

  // Track changes
  useEffect(() => {
    const hasChanges =
      formName !== (name || '') ||
      formNotes !== (notes || '') ||
      formIconType !== (icon_type || '') ||
      formColor !== (color || '#3388ff') ||
      formArrival !== toDatetimeLocalValue(estimated_arrival) ||
      formDuration !== (estimated_duration_minutes || '') ||
      formHazardSubtype !== (hazard_subtype || 'other') ||
      formDifficultyGrade !== (difficulty_grade || '');
    setIsDirty(hasChanges);
  }, [
    formName, formNotes, formIconType, formColor, formArrival, formDuration, 
    formHazardSubtype, formDifficultyGrade,
    name, notes, icon_type, color, estimated_arrival, estimated_duration_minutes,
    hazard_subtype, difficulty_grade
  ]);

  const handleSave = useCallback(() => {
    const updates = {
      properties: {
        ...feature.properties,
        name: formName.trim() || null,
        notes: formNotes.trim() || null,
        color: formColor,
      },
    };

    // Only update point-specific fields for point categories
    if (isPointCategory) {
      updates.properties.icon_type = formIconType || null;
    }

    // Only update time fields for waypoint category
    if (isWaypoint) {
      updates.properties.estimated_arrival = formArrival
        ? new Date(formArrival).toISOString()
        : null;
      updates.properties.estimated_duration_minutes =
        typeof formDuration === 'number' && formDuration > 0 ? formDuration : null;
    }

    // Update hazard specific fields
    if (isHazard) {
      updates.properties.hazard_subtype = formHazardSubtype;
      updates.properties.difficulty_grade = formDifficultyGrade;
    }

    onUpdate(feature.id, updates);
    onClose();
  }, [
    feature,
    formName,
    formNotes,
    formColor,
    formIconType,
    formArrival,
    formDuration,
    formHazardSubtype,
    formDifficultyGrade,
    isPointCategory,
    isWaypoint,
    isHazard,
    onUpdate,
    onClose,
  ]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(feature.id);
    }
    onClose();
  }, [feature.id, onDelete, onClose]);

  const handleDurationChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setFormDuration(value === '' ? '' : parseInt(value, 10));
    }
  };

  const getDifficultyOptions = () => {
    if (formHazardSubtype === 'river_tracing') return RIVER_TRACING_GRADES;
    if (formHazardSubtype === 'rock_climbing') return ROCK_CLIMBING_GRADES;
    return [];
  };

  return (
    <div className="semantic-popup-editor">
      {/* Category badge (read-only) */}
      <div className="category-badge">
        <span className="category-icon">{getCategoryIcon(category)}</span>
        <span className="category-label">{getCategoryLabel(category)}</span>
      </div>

      {/* Coordinates display (read-only for points) */}
      {isPoint && coordinates && (
        <div className="coords-display">
          <span className="coords-icon">📍</span>
          <span className="coords-value">{formatCoordinates(coordinates, 5)}</span>
        </div>
      )}

      {/* Name input */}
      <div className="form-field">
        <label htmlFor="popup-name">Name</label>
        <input
          id="popup-name"
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={`${getCategoryLabel(category)} name`}
          disabled={readOnly}
        />
      </div>

      {/* Hazard Type Selector */}
      {isHazard && (
        <div className="form-field">
          <label htmlFor="popup-hazard-type">Type</label>
          <select
            id="popup-hazard-type"
            value={formHazardSubtype}
            onChange={(e) => {
              setFormHazardSubtype(e.target.value);
              setFormDifficultyGrade(''); // Reset grade when type changes
            }}
            disabled={readOnly}
          >
            {HAZARD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Difficulty Grade Selector */}
      {isHazard && formHazardSubtype !== 'other' && (
        <div className="form-field">
          <label htmlFor="popup-difficulty">Grade / Difficulty</label>
          <select
            id="popup-difficulty"
            value={formDifficultyGrade}
            onChange={(e) => setFormDifficultyGrade(e.target.value)}
            disabled={readOnly}
          >
            <option value="">Select grade...</option>
            {getDifficultyOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Icon selector (points only, non-hazard) */}
      {isPointCategory && !isHazard && (
        <div className="form-field">
          <label htmlFor="popup-icon">Icon Type</label>
          <select
            id="popup-icon"
            value={formIconType}
            onChange={(e) => setFormIconType(e.target.value)}
            disabled={readOnly}
          >
            <option value="">Select icon...</option>
            {MARKER_ICON_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Time fields (WAYPOINT only) */}
      {isWaypoint && (
        <div className="time-fields">
          <div className="form-field">
            <label htmlFor="popup-arrival">Planned Arrival</label>
            <input
              id="popup-arrival"
              type="datetime-local"
              value={formArrival}
              onChange={(e) => setFormArrival(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="form-field">
            <label htmlFor="popup-duration">Stop Duration (min)</label>
            <input
              id="popup-duration"
              type="number"
              min="0"
              step="5"
              value={formDuration}
              onChange={handleDurationChange}
              placeholder="Optional"
              disabled={readOnly}
            />
          </div>
        </div>
      )}

      {/* Color picker */}
      <div className="form-field color-field">
        <label htmlFor="popup-color">Color</label>
        <div className="color-input-wrapper">
          <input
            id="popup-color"
            type="color"
            value={formColor}
            onChange={(e) => setFormColor(e.target.value)}
            disabled={readOnly}
          />
          <span className="color-value">{formColor}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="form-field">
        <label htmlFor="popup-notes">Notes</label>
        <textarea
          id="popup-notes"
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          placeholder="Planning notes..."
          rows={3}
          disabled={readOnly}
        />
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="popup-actions">
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={!isDirty}
          >
            Save
          </button>
          <button className="cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          {onDelete && (
            <button className="delete-btn" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      )}

      {readOnly && (
        <div className="popup-actions">
          <button className="close-btn" onClick={handleCancel}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

SemanticPopupEditor.propTypes = {
  feature: PropTypes.shape({
    id: PropTypes.string.isRequired,
    geometry: PropTypes.shape({
      type: PropTypes.string,
      coordinates: PropTypes.any,
    }),
    properties: PropTypes.shape({
      category: PropTypes.string,
      name: PropTypes.string,
      notes: PropTypes.string,
      icon_type: PropTypes.string,
      color: PropTypes.string,
      estimated_arrival: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      estimated_duration_minutes: PropTypes.number,
    }),
  }).isRequired,
  onUpdate: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  readOnly: PropTypes.bool,
};

SemanticPopupEditor.defaultProps = {
  readOnly: false,
  onDelete: null,
};

export default SemanticPopupEditor;
