// client/src/components/common/FeatureStyleEditor.js
/**
 * FeatureStyleEditor - Popup editor for feature properties and styling.
 * 
 * Allows editing:
 * - Feature name and description
 * - Stroke/fill colors
 * - Line width and opacity
 * - Fill opacity
 * - Fill pattern (FE-05: Solid, Crosshatch, None)
 */
import React, { useState, useEffect } from 'react';
import { SEMANTIC_TYPE } from '../../services/planService';
import './FeatureStyleEditor.css';

// FE-05: Updated color presets per PRD (Red, Orange, Teal, Blue, Grey)
const COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Grey', value: '#6b7280' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Black', value: '#1f2937' },
];

// FE-05: Fill pattern options per PRD
const FILL_PATTERNS = [
  { name: 'Solid', value: 'solid', description: 'Solid fill with opacity' },
  { name: 'Crosshatch', value: 'crosshatch', description: 'Diagonal line pattern' },
  { name: 'None', value: 'none', description: 'Outline only' },
];

const HAZARD_TYPES = [
  { value: 'other', label: 'Other (⚠️)' },
  { value: 'river_tracing', label: 'River Tracing (🌊)' },
  { value: 'rock_climbing', label: 'Rock Climbing (🧗)' },
];

const RIVER_TRACING_GRADES = [
  { value: 'Class A', label: 'Class A (Experience)' },
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

const FeatureStyleEditor = ({ feature, onUpdate, onClose, readOnly, onPreviewUpdate }) => {
  const [name, setName] = useState(feature.properties?.name || '');
  const [description, setDescription] = useState(feature.properties?.description || '');
  const [color, setColor] = useState(feature.properties?.color || '#3b82f6');
  const [fillColor, setFillColor] = useState(feature.properties?.fillColor || feature.properties?.color || '#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState(feature.properties?.strokeWidth || 3);
  const [opacity, setOpacity] = useState(feature.properties?.opacity ?? 0.8);
  const [fillOpacity, setFillOpacity] = useState(feature.properties?.fillOpacity ?? 0.2);
  // FE-05: Fill pattern state
  const [fillPattern, setFillPattern] = useState(feature.properties?.fillPattern || 'solid');
  
  // Hazard specific state
  const [hazardSubtype, setHazardSubtype] = useState(feature.properties?.hazard_subtype || 'other');
  const [difficultyGrade, setDifficultyGrade] = useState(feature.properties?.difficulty_grade || '');

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFillColorPicker, setShowFillColorPicker] = useState(false);
  const [colorPickerType, setColorPickerType] = useState('stroke'); // 'stroke' or 'fill'

  // Helper to trigger immediate preview updates for real-time feedback
  const triggerPreview = (styleUpdates) => {
    if (onPreviewUpdate && typeof onPreviewUpdate === 'function') {
      const previewProperties = {
        ...feature.properties,
        ...styleUpdates,
        _style: {
          ...feature.properties._style,
          color: styleUpdates.color || color,
          weight: styleUpdates.strokeWidth || strokeWidth,
          opacity: styleUpdates.opacity ?? opacity,
          fillColor: styleUpdates.fillColor || fillColor,
          fillOpacity: styleUpdates.fillOpacity ?? fillOpacity,
        },
      };
      onPreviewUpdate(feature.id, { properties: previewProperties });
    }
  };

  // Helper to stop event propagation to Leaflet map
  // This is critical to prevent the popup from closing or the map from dragging
  // when interacting with inputs inside the popup.
  const stopPropagation = (e) => {
    e.stopPropagation();
    e.preventDefault(); // Also prevent default actions
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // Comprehensive event stopper for drag-sensitive controls (sliders)
  const stopAllEvents = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // FIX: Helper specifically for range inputs that needs default behavior (dragging)
  // but must stop propagation to Leaflet map
  const stopDragPropagation = (e) => {
    e.stopPropagation();
    // Do NOT call e.preventDefault() here, or the slider won't move!
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // BUG FIX: Sync state when feature prop changes (e.g., modal reopened for same feature)
  // This ensures the modal displays current values, not stale initial state
  useEffect(() => {
    const style = feature.properties?._style || {};
    setName(feature.properties?.name || '');
    setDescription(feature.properties?.description || '');
    
    // Read from _style first, then flat properties
    setColor(style.color || feature.properties?.color || '#3b82f6');
    setFillColor(style.fillColor || feature.properties?.fillColor || feature.properties?.color || '#3b82f6');
    setStrokeWidth(style.weight || feature.properties?.strokeWidth || 3);
    setOpacity(style.opacity ?? feature.properties?.opacity ?? 0.8);
    setFillOpacity(style.fillOpacity ?? feature.properties?.fillOpacity ?? 0.2);
    
    setFillPattern(feature.properties?.fillPattern || 'solid');
    setHazardSubtype(feature.properties?.hazard_subtype || 'other');
    setDifficultyGrade(feature.properties?.difficulty_grade || '');
    // Reset color pickers
    setShowColorPicker(false);
    setShowFillColorPicker(false);
  }, [feature.id, feature.properties]);

  const isPolygon = feature.geometry?.type === 'Polygon';
  const isPolyline = feature.geometry?.type === 'LineString';
  const isPoint = feature.geometry?.type === 'Point';
  const isHazard = feature.properties?.semantic_type === SEMANTIC_TYPE.HAZARD;

  const handleSave = (e) => {
    if (e) stopPropagation(e);

    const updates = {
      properties: {
        ...feature.properties,
        name: name.trim() || null,
        description: description.trim() || null,
      },
    };

    // Only add style properties for non-point features
    if (!isPoint) {
      // Create _style object per schema requirement
      updates.properties._style = {
        color: color,
        weight: strokeWidth,
        opacity: opacity,
      };

      // Maintain flat properties for backward compatibility
      updates.properties.color = color;
      updates.properties.strokeWidth = strokeWidth;
      updates.properties.opacity = opacity;
      
      if (isPolygon) {
        // Ensure fill settings are saved to _style
        updates.properties._style.fillColor = fillColor;
        updates.properties._style.fillOpacity = fillOpacity;
        
        updates.properties.fillColor = fillColor;
        updates.properties.fillOpacity = fillOpacity;
        // FE-05: Save fill pattern
        updates.properties.fillPattern = fillPattern;
      }
    }

    // Hazard properties
    if (isHazard) {
      updates.properties.hazard_subtype = hazardSubtype;
      updates.properties.difficulty_grade = difficultyGrade;
    }

    onUpdate(feature.id, updates);
    onClose();
  };

  const getFeatureTypeLabel = () => {
    if (isHazard) return '⚠️ Hazard';
    if (isPoint) return '📍 Marker';
    if (isPolyline) return '〰️ Route';
    if (isPolygon) {
      const shapeType = feature.properties?.shape_type;
      if (shapeType === 'rectangle') return '▭ Rectangle';
      if (shapeType === 'circle') return '◯ Circle';
      return '⬡ Polygon';
    }
    return 'Feature';
  };

  const getDifficultyOptions = () => {
    if (hazardSubtype === 'river_tracing') return RIVER_TRACING_GRADES;
    if (hazardSubtype === 'rock_climbing') return ROCK_CLIMBING_GRADES;
    return [];
  };

  return (
    <div 
      className="feature-style-editor"
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
      onDoubleClick={stopPropagation}
    >
      <div className="editor-header">
        <h3>{getFeatureTypeLabel()}</h3>
        <button className="close-btn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <div className="editor-body">
        {/* Name field */}
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter feature name"
            disabled={readOnly}
            onMouseDown={stopPropagation}
          />
        </div>

        {/* Hazard Type Selector */}
        {isHazard && (
          <div className="form-group">
            <label>Type</label>
            <select
              className="type-select"
              value={hazardSubtype}
              onChange={(e) => {
                setHazardSubtype(e.target.value);
                setDifficultyGrade(''); // Reset grade when type changes
              }}
              disabled={readOnly}
              onMouseDown={stopPropagation}
            >
              {HAZARD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Difficulty Grade Selector */}
        {isHazard && hazardSubtype !== 'other' && (
          <div className="form-group">
            <label>Difficulty</label>
            <select
              className="grade-select"
              value={difficultyGrade}
              onChange={(e) => setDifficultyGrade(e.target.value)}
              disabled={readOnly}
              onMouseDown={stopPropagation}
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

        {/* Description field */}
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description (optional)"
            rows={2}
            disabled={readOnly}
            onMouseDown={stopPropagation}
          />
        </div>

        {/* Style options for non-point features */}
        {!isPoint && (
          <>
            <div className="form-divider" />

            {/* Stroke color */}
            <div className="form-group">
              <label>Stroke Color</label>
              <div className="color-input-group">
                <div
                  className="color-preview"
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    stopPropagation(e);
                    setColorPickerType('stroke');
                    setShowColorPicker(!showColorPicker);
                    setShowFillColorPicker(false);
                  }}
                  onMouseDown={stopPropagation}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={readOnly}
                  onMouseDown={stopPropagation}
                />
              </div>
              {showColorPicker && colorPickerType === 'stroke' && (
                <div 
                  className="color-picker-popup" 
                  onClick={stopPropagation} 
                  onMouseDown={stopPropagation}
                  onMouseUp={stopPropagation}
                  onMouseMove={stopPropagation}
                  onTouchStart={stopPropagation}
                  onTouchMove={stopPropagation}
                >
                  <div className="color-presets">
                    {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          className="color-preset-btn"
                          style={{ backgroundColor: preset.value }}
                          onClick={(e) => {
                            stopAllEvents(e);
                            setColor(preset.value);
                            triggerPreview({ color: preset.value });
                            setShowColorPicker(false);
                          }}
                          onMouseDown={stopAllEvents}
                          onMouseUp={stopAllEvents}
                          title={preset.name}
                        />
                    ))}
                  </div>
                  <div className="custom-color-input">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        triggerPreview({ color: e.target.value });
                      }}
                      onClick={stopAllEvents}
                      onMouseDown={stopAllEvents}
                      onMouseUp={stopAllEvents}
                    />
                    <span>Custom</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fill color for polygons */}
            {isPolygon && (
              <div className="form-group">
                <label>Fill Color</label>
                <div className="color-input-group">
                  <div
                    className="color-preview"
                    style={{ backgroundColor: fillColor }}
                    onClick={(e) => {
                      stopPropagation(e);
                      setColorPickerType('fill');
                      setShowFillColorPicker(!showFillColorPicker);
                      setShowColorPicker(false);
                    }}
                    onMouseDown={stopPropagation}
                  />
                  <input
                    type="text"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    disabled={readOnly}
                    onMouseDown={stopPropagation}
                  />
                </div>
                {showFillColorPicker && colorPickerType === 'fill' && (
                  <div 
                    className="color-picker-popup" 
                    onClick={stopPropagation} 
                    onMouseDown={stopPropagation}
                    onMouseUp={stopPropagation}
                    onMouseMove={stopPropagation}
                    onTouchStart={stopPropagation}
                    onTouchMove={stopPropagation}
                  >
                    <div className="color-presets">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          className="color-preset-btn"
                          style={{ backgroundColor: preset.value }}
                          onClick={(e) => {
                            stopAllEvents(e);
                            setFillColor(preset.value);
                            triggerPreview({ fillColor: preset.value });
                            setShowFillColorPicker(false);
                          }}
                          onMouseDown={stopAllEvents}
                          onMouseUp={stopAllEvents}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  <div className="custom-color-input">
                    <input
                      type="color"
                      value={fillColor}
                      onChange={(e) => {
                        setFillColor(e.target.value);
                        triggerPreview({ fillColor: e.target.value });
                      }}
                      onClick={stopAllEvents}
                      onMouseDown={stopAllEvents}
                      onMouseUp={stopAllEvents}
                    />
                    <span>Custom</span>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Stroke width */}
            <div className="form-group">
              <label>Stroke Width: {strokeWidth}px</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={strokeWidth}
                  onChange={(e) => {
                    const newStrokeWidth = Number(e.target.value);
                    setStrokeWidth(newStrokeWidth);
                    triggerPreview({ strokeWidth: newStrokeWidth });
                  }}
                  onMouseDown={stopDragPropagation}
                  onTouchStart={stopDragPropagation}
                  onClick={(e) => e.stopPropagation()}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Stroke opacity */}
            <div className="form-group">
              <label>Stroke Opacity: {Math.round(opacity * 100)}%</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => {
                    const newOpacity = Number(e.target.value);
                    setOpacity(newOpacity);
                    triggerPreview({ opacity: newOpacity });
                  }}
                  onMouseDown={stopDragPropagation}
                  onTouchStart={stopDragPropagation}
                  onClick={(e) => e.stopPropagation()}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Fill opacity for polygons */}
            {isPolygon && (
              <div className="form-group">
                <label>Fill Opacity: {Math.round(fillOpacity * 100)}%</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={fillOpacity}
                    onChange={(e) => {
                      const newFillOpacity = Number(e.target.value);
                      setFillOpacity(newFillOpacity);
                      triggerPreview({ fillOpacity: newFillOpacity });
                    }}
                    onMouseDown={stopDragPropagation}
                    onTouchStart={stopDragPropagation}
                    onClick={(e) => e.stopPropagation()}
                    disabled={readOnly || fillPattern === 'none'}
                  />
                </div>
              </div>
            )}

            {/* FE-05: Fill pattern selector for polygons */}
            {isPolygon && (
              <div className="form-group">
                <label>Fill Pattern</label>
                <div className="fill-pattern-selector">
                  {FILL_PATTERNS.map((pattern) => (
                    <button
                      key={pattern.value}
                      className={`pattern-option ${fillPattern === pattern.value ? 'active' : ''}`}
                      onClick={(e) => {
                        stopPropagation(e);
                        setFillPattern(pattern.value);
                      }}
                      onMouseDown={stopPropagation}
                      disabled={readOnly}
                      title={pattern.description}
                    >
                      <span className={`pattern-icon pattern-${pattern.value}`}>
                        {pattern.value === 'solid' && '█'}
                        {pattern.value === 'crosshatch' && '▤'}
                        {pattern.value === 'none' && '▢'}
                      </span>
                      <span className="pattern-name">{pattern.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!readOnly && (
        <div className="editor-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave}>
            Save
          </button>
        </div>
      )}
    </div>
  );
};

export default FeatureStyleEditor;
