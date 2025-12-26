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

const FeatureStyleEditor = ({ feature, onUpdate, onClose, readOnly }) => {
  const [name, setName] = useState(feature.properties?.name || '');
  const [description, setDescription] = useState(feature.properties?.description || '');
  const [color, setColor] = useState(feature.properties?.color || '#3b82f6');
  const [fillColor, setFillColor] = useState(feature.properties?.fillColor || feature.properties?.color || '#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState(feature.properties?.strokeWidth || 3);
  const [opacity, setOpacity] = useState(feature.properties?.opacity ?? 0.8);
  const [fillOpacity, setFillOpacity] = useState(feature.properties?.fillOpacity ?? 0.2);
  // FE-05: Fill pattern state
  const [fillPattern, setFillPattern] = useState(feature.properties?.fillPattern || 'solid');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFillColorPicker, setShowFillColorPicker] = useState(false);
  const [colorPickerType, setColorPickerType] = useState('stroke'); // 'stroke' or 'fill'

  // BUG FIX: Sync state when feature prop changes (e.g., modal reopened for same feature)
  // This ensures the modal displays current values, not stale initial state
  useEffect(() => {
    setName(feature.properties?.name || '');
    setDescription(feature.properties?.description || '');
    setColor(feature.properties?.color || '#3b82f6');
    setFillColor(feature.properties?.fillColor || feature.properties?.color || '#3b82f6');
    setStrokeWidth(feature.properties?.strokeWidth || 3);
    setOpacity(feature.properties?.opacity ?? 0.8);
    setFillOpacity(feature.properties?.fillOpacity ?? 0.2);
    setFillPattern(feature.properties?.fillPattern || 'solid');
    // Reset color pickers
    setShowColorPicker(false);
    setShowFillColorPicker(false);
  }, [feature.id, feature.properties]);

  const isPolygon = feature.geometry?.type === 'Polygon';
  const isPolyline = feature.geometry?.type === 'LineString';
  const isPoint = feature.geometry?.type === 'Point';

  const handleSave = () => {
    const updates = {
      properties: {
        ...feature.properties,
        name: name.trim() || null,
        description: description.trim() || null,
      },
    };

    // Only add style properties for non-point features
    if (!isPoint) {
      updates.properties.color = color;
      updates.properties.strokeWidth = strokeWidth;
      updates.properties.opacity = opacity;
      
      if (isPolygon) {
        updates.properties.fillColor = fillColor;
        updates.properties.fillOpacity = fillOpacity;
        // FE-05: Save fill pattern
        updates.properties.fillPattern = fillPattern;
      }
    }

    onUpdate(feature.id, updates);
    onClose();
  };

  const getFeatureTypeLabel = () => {
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

  return (
    <div className="feature-style-editor">
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
          />
        </div>

        {/* Description field */}
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description (optional)"
            rows={2}
            disabled={readOnly}
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
                  onClick={() => {
                    setColorPickerType('stroke');
                    setShowColorPicker(!showColorPicker);
                    setShowFillColorPicker(false);
                  }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              {showColorPicker && colorPickerType === 'stroke' && (
                <div className="color-picker-popup">
                  <div className="color-presets">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        className="color-preset-btn"
                        style={{ backgroundColor: preset.value }}
                        onClick={() => {
                          setColor(preset.value);
                          setShowColorPicker(false);
                        }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                  <div className="custom-color-input">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
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
                    onClick={() => {
                      setColorPickerType('fill');
                      setShowFillColorPicker(!showFillColorPicker);
                      setShowColorPicker(false);
                    }}
                  />
                  <input
                    type="text"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                {showFillColorPicker && colorPickerType === 'fill' && (
                  <div className="color-picker-popup">
                    <div className="color-presets">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          className="color-preset-btn"
                          style={{ backgroundColor: preset.value }}
                          onClick={() => {
                            setFillColor(preset.value);
                            setShowFillColorPicker(false);
                          }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                    <div className="custom-color-input">
                      <input
                        type="color"
                        value={fillColor}
                        onChange={(e) => setFillColor(e.target.value)}
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
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                disabled={readOnly}
              />
            </div>

            {/* Stroke opacity */}
            <div className="form-group">
              <label>Stroke Opacity: {Math.round(opacity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                disabled={readOnly}
              />
            </div>

            {/* Fill opacity for polygons */}
            {isPolygon && (
              <div className="form-group">
                <label>Fill Opacity: {Math.round(fillOpacity * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={fillOpacity}
                  onChange={(e) => setFillOpacity(Number(e.target.value))}
                  disabled={readOnly || fillPattern === 'none'}
                />
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
                      onClick={() => setFillPattern(pattern.value)}
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
