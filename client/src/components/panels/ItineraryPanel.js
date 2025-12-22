// client/src/components/panels/ItineraryPanel.js
/**
 * ItineraryPanel - Side panel showing plan features and reference tracks.
 * 
 * Features can be reordered via drag-and-drop, edited, and deleted.
 * Reference tracks are shown as read-only GPX baselines.
 */
import React, { useState, useCallback } from 'react';
import { MARKER_ICON_TYPES } from '../../services/planService';
import './ItineraryPanel.css';

const FeatureItem = ({
  feature,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  readOnly,
  getMarkerEmoji,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');

  const handleStartEdit = () => {
    if (readOnly) return;
    setEditedName(feature.properties?.name || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onUpdate(feature.id, {
      properties: { ...feature.properties, name: editedName.trim() || null },
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
  };

  const getFeatureIcon = () => {
    const type = feature.geometry?.type;
    const shapeType = feature.properties?.shape_type;
    if (type === 'Point') {
      return '📍';
    }
    if (type === 'LineString') {
      return '〰️';
    }
    if (type === 'Polygon') {
      if (shapeType === 'rectangle') return '▭';
      if (shapeType === 'circle') return '◯';
      return '⬡';
    }
    return '•';
  };

  const getFeatureLabel = () => {
    if (feature.properties?.name) {
      return feature.properties.name;
    }
    const type = feature.geometry?.type;
    const shapeType = feature.properties?.shape_type;
    if (type === 'Point') {
      return 'Marker';
    }
    if (type === 'LineString') {
      return 'Route';
    }
    if (type === 'Polygon') {
      if (shapeType === 'rectangle') return 'Rectangle';
      if (shapeType === 'circle') return 'Circle';
      return 'Polygon';
    }
    return 'Feature';
  };

  return (
    <div
      className={`feature-item ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(feature.id)}
    >
      <span className="feature-icon">{getFeatureIcon()}</span>

      {isEditing ? (
        <div className="feature-edit" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            placeholder="Feature name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
          />
          <button onClick={handleSaveEdit} title="Save">
            ✓
          </button>
          <button onClick={handleCancelEdit} title="Cancel">
            ✕
          </button>
        </div>
      ) : (
        <>
          <span className="feature-name" onDoubleClick={handleStartEdit}>
            {getFeatureLabel()}
          </span>

          {!readOnly && (
            <div className="feature-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit();
                }}
                title="Edit name"
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(feature.id);
                }}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ReferenceTrackItem = ({ track, onRemove, readOnly }) => {
  return (
    <div className="reference-track-item">
      <span className="track-icon">🛤️</span>
      <span className="track-name">{track.display_name || track.filename}</span>
      {!readOnly && (
        <button
          className="track-remove"
          onClick={() => onRemove(track.id)}
          title="Remove track"
        >
          ✕
        </button>
      )}
    </div>
  );
};

const ItineraryPanel = ({
  features,
  referenceTracks,
  selectedFeatureId,
  onSelectFeature,
  onUpdateFeature,
  onDeleteFeature,
  onReorderFeatures,
  onAddReferenceTrack,
  onRemoveReferenceTrack,
  width,
  onWidthChange,
  readOnly,
  getMarkerEmoji,
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Ensure features is an array (handle FeatureCollection object case)
  const featuresArray = Array.isArray(features) ? features : (features?.features || []);

  // Sort features by order_index
  const sortedFeatures = [...featuresArray].sort(
    (a, b) => (a.order_index ?? 999) - (b.order_index ?? 999)
  );

  // Drag and drop handlers
  const handleDragStart = (index) => {
    if (readOnly) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (readOnly || draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (readOnly || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    // Calculate new order
    const newOrder = [...sortedFeatures];
    const [moved] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, moved);

    // Create order updates
    const featureOrders = newOrder.map((f, i) => ({
      feature_id: f.id,
      order_index: i,
    }));

    onReorderFeatures(featureOrders);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Panel resize
  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.min(500, Math.max(280, startWidth + delta));
        onWidthChange(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, onWidthChange]
  );

  return (
    <aside className="itinerary-panel" style={{ width }}>
      <div className="resize-handle" onMouseDown={handleResizeStart} />

      <div className="panel-header">
        <h3>Itinerary</h3>
        <span className="feature-count">
          {sortedFeatures.length} {sortedFeatures.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="panel-content">
        {/* Features Section */}
        <section className="features-section">
          <h4>Features</h4>
          {sortedFeatures.length === 0 ? (
            <p className="empty-message">
              {readOnly
                ? 'No features added yet.'
                : 'Use the tools to add markers, routes, and areas.'}
            </p>
          ) : (
            <div className="features-list">
              {sortedFeatures.map((feature, index) => (
                <div
                  key={feature.id}
                  draggable={!readOnly}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={draggedIndex === index ? 'dragging' : ''}
                >
                  <FeatureItem
                    feature={feature}
                    selected={feature.id === selectedFeatureId}
                    onSelect={onSelectFeature}
                    onUpdate={onUpdateFeature}
                    onDelete={onDeleteFeature}
                    readOnly={readOnly}
                    getMarkerEmoji={getMarkerEmoji}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reference Tracks Section */}
        <section className="tracks-section">
          <h4>Reference Tracks</h4>
          {(!referenceTracks || referenceTracks.length === 0) ? (
            <p className="empty-message">
              {readOnly
                ? 'No reference tracks added.'
                : 'Add GPX tracks as reference baselines.'}
            </p>
          ) : (
            <div className="tracks-list">
              {referenceTracks.map((track) => (
                <ReferenceTrackItem
                  key={track.id}
                  track={track}
                  onRemove={onRemoveReferenceTrack}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}

          {/* TODO: Add reference track button/upload */}
        </section>
      </div>
    </aside>
  );
};

export default ItineraryPanel;
