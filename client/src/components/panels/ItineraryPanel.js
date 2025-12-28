// client/src/components/panels/ItineraryPanel.js
/**
 * ItineraryPanel - Side panel showing plan features and reference tracks.
 * 
 * The panel has THREE sections:
 * 1. Checkpoints - Waypoint features sorted by estimated_arrival (time-sorted)
 * 2. Other Features - Markers, routes, areas sorted by order_index (drag-drop reorder)
 * 3. Reference Tracks - Read-only GPX baselines
 */
import React, { useState, useCallback, useMemo } from 'react';
import CheckpointItem from './CheckpointItem';
import {
  FEATURE_CATEGORY,
  getCategoryIcon,
  getCategoryLabel,
} from '../../services/planService';
import './ItineraryPanel.css';

/**
 * FeatureItem - Generic item for non-checkpoint features (markers, routes, areas).
 * Supports FE-06: Double-click to navigate/flyTo map location.
 */
const FeatureItem = ({
  feature,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onDoubleClick,
  readOnly,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  const category = feature.properties?.category || 'marker';

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

  // FE-06: Handle double-click to fly to feature
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick(feature.id);
    }
  };

  const getFeatureIcon = () => {
    // Use category icon first, fallback to geometry-based icon
    if (category) {
      return getCategoryIcon(category);
    }
    const type = feature.geometry?.type;
    const shapeType = feature.properties?.shape_type;
    if (type === 'Point') {
      return '📌';
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
    // Use category label
    if (category) {
      return getCategoryLabel(category);
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
      onDoubleClick={handleDoubleClick}
      title="Double-click to navigate on map"
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

const DaySummaryCard = ({ summary, onChange, readOnly }) => {
  const handleFieldChange = (field, value) => {
    if (onChange) {
      onChange(summary.day_number, field, value);
    }
  };

  return (
    <div className="day-summary-card">
      <div className="day-summary-header">
        <span className="day-pill">Day {summary.day_number}</span>
        {!readOnly && (
          <input
            type="text"
            value={summary.title || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Title (optional)"
          />
        )}
        {readOnly && summary.title && <span className="day-title">{summary.title}</span>}
      </div>
      {!readOnly && (
        <div className="day-summary-fields">
          <textarea
            value={summary.route_summary || ''}
            onChange={(e) => handleFieldChange('route_summary', e.target.value)}
            placeholder="Route summary, key moves, timing..."
            rows={2}
          />
          <textarea
            value={summary.conditions || ''}
            onChange={(e) => handleFieldChange('conditions', e.target.value)}
            placeholder="Conditions (weather, trail, avalanche, etc.)"
            rows={2}
          />
        </div>
      )}
      {readOnly && (
        <div className="day-summary-readonly">
          {summary.route_summary && <p className="day-summary-text">{summary.route_summary}</p>}
          {summary.conditions && (
            <p className="day-summary-conditions">Conditions: {summary.conditions}</p>
          )}
        </div>
      )}
    </div>
  );
};

// UI-03: Reference track item with visibility toggles for track line and waypoints
const ReferenceTrackItem = ({ track, onRemove, onToggleVisibility, readOnly }) => {
  const showTrack = track.showTrack !== false; // Default true
  const showWaypoints = track.showWaypoints === true; // Default false
  
  return (
    <div className="reference-track-item">
      <span className="track-icon">🛤️</span>
      <span className="track-name">{track.display_name || track.filename}</span>
      <div className="track-controls">
        {/* Toggle track line visibility */}
        <button
          className={`track-toggle ${showTrack ? 'active' : ''}`}
          onClick={() => onToggleVisibility?.(track.id, 'showTrack', !showTrack)}
          title={showTrack ? 'Hide track line' : 'Show track line'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        {/* Toggle waypoints visibility */}
        <button
          className={`track-toggle ${showWaypoints ? 'active' : ''}`}
          onClick={() => onToggleVisibility?.(track.id, 'showWaypoints', !showWaypoints)}
          title={showWaypoints ? 'Hide reference waypoints' : 'Show reference waypoints'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
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
    </div>
  );
};

const ItineraryPanel = ({
  features,
  referenceTracks,
  selectedFeatureId,
  onSelectFeature,
  onUpdateFeature,
  onUpdateFeatureWithCascade, // Optional: for cascade time updates
  onDeleteFeature,
  onReorderFeatures,
  onCenterFeature,
  onFlyToFeature, // FE-06: Navigate map to feature with flyTo + flash
  onAddReferenceTrack,
  onRemoveReferenceTrack,
  onToggleTrackVisibility, // UI-03: Toggle track/waypoint visibility
  width,
  onWidthChange,
  daySummaries = [],
  onUpdateDaySummaries,
  onSaveDaySummaries,
  daySummariesDirty,
  savingDaySummaries,
  readOnly,
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Ensure features is an array (handle FeatureCollection object case)
  const featuresArray = useMemo(() => {
    return Array.isArray(features) ? features : (features?.features || []);
  }, [features]);

  // Separate features by category: checkpoints (waypoints) vs other features
  const { checkpoints, otherFeatures } = useMemo(() => {
    const cp = [];
    const other = [];
    
    featuresArray.forEach((feature) => {
      const category = feature.properties?.category;
      // Match both string 'waypoint' and constant FEATURE_CATEGORY.WAYPOINT
      const isWaypoint = category === 'waypoint' || category === FEATURE_CATEGORY.WAYPOINT;
      if (isWaypoint) {
        cp.push(feature);
      } else {
        other.push(feature);
      }
    });
    
    return { checkpoints: cp, otherFeatures: other };
  }, [featuresArray]);

  // Sort checkpoints by estimated_arrival (ascending), nulls last
  const sortedCheckpoints = useMemo(() => {
    return [...checkpoints].sort((a, b) => {
      const aTime = a.properties?.estimated_arrival;
      const bTime = b.properties?.estimated_arrival;
      
      // Both have times - sort by time
      if (aTime && bTime) {
        return new Date(aTime) - new Date(bTime);
      }
      // Only a has time - a comes first
      if (aTime && !bTime) return -1;
      // Only b has time - b comes first
      if (!aTime && bTime) return 1;
      // Neither has time - sort by order_index, then created_at
      const aOrder = a.properties?.order_index ?? Infinity;
      const bOrder = b.properties?.order_index ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      const aCreated = a.properties?.created_at;
      const bCreated = b.properties?.created_at;
      if (aCreated && bCreated) {
        return new Date(aCreated) - new Date(bCreated);
      }
      return 0;
    });
  }, [checkpoints]);

  // Sort other features by order_index
  const sortedOtherFeatures = useMemo(() => {
    return [...otherFeatures].sort((a, b) => {
      const aOrder = a.properties?.order_index ?? Infinity;
      const bOrder = b.properties?.order_index ?? Infinity;
      return aOrder - bOrder;
    });
  }, [otherFeatures]);

  const sortedDaySummaries = useMemo(() => {
    const summaries = Array.isArray(daySummaries) ? daySummaries : [];
    return [...summaries].sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
  }, [daySummaries]);

  const handleDaySummaryChange = (dayNumber, field, value) => {
    if (!onUpdateDaySummaries) return;
    const base = Array.isArray(daySummaries) ? daySummaries : [];
    const updated = base.map((day) =>
      day.day_number === dayNumber ? { ...day, [field]: value } : day
    );
    onUpdateDaySummaries(updated);
  };

  const handleAddDay = () => {
    if (!onUpdateDaySummaries) return;
    const base = Array.isArray(daySummaries) ? daySummaries : [];
    const nextDayNumber = base.reduce((max, day) => Math.max(max, day.day_number || 0), 0) + 1;
    const newEntry = {
      day_number: nextDayNumber,
      title: `Day ${nextDayNumber}`,
      route_summary: '',
      conditions: '',
    };
    onUpdateDaySummaries([...base, newEntry]);
  };

  // Drag and drop handlers (for Other Features only, checkpoints are time-sorted)
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

    // Calculate new order for Other Features only
    const newOrder = [...sortedOtherFeatures];
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
        <div>
          <h3>Itinerary</h3>
          <p className="panel-subtitle">Journey Log</p>
        </div>
        <span className="feature-count">
          {featuresArray.length} {featuresArray.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="panel-content">
        <section className="day-summary-section">
          <div className="section-header-row">
            <h4>
              <span className="section-icon">📝</span>
              Day Summaries
              <span className="section-count">({sortedDaySummaries.length})</span>
            </h4>
            {!readOnly && (
              <div className="day-summary-actions">
                <button className="add-day-btn" onClick={handleAddDay} title="Add day summary">
                  + Add Day
                </button>
                {daySummariesDirty && (
                  <button
                    className="save-day-btn"
                    onClick={() => onSaveDaySummaries?.()}
                    disabled={savingDaySummaries}
                    title="Save day summaries"
                  >
                    {savingDaySummaries ? 'Saving...' : 'Save' }
                  </button>
                )}
              </div>
            )}
          </div>
          {sortedDaySummaries.length === 0 ? (
            <p className="empty-message">
              {readOnly
                ? 'No day summaries added.'
                : 'Add a quick summary for each day (route overview and conditions).'}
            </p>
          ) : (
            <div className="day-summary-list">
              {sortedDaySummaries.map((summary) => (
                <DaySummaryCard
                  key={summary.day_number}
                  summary={summary}
                  onChange={handleDaySummaryChange}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 1: Checkpoints (time-sorted waypoints) */}
        <section className="checkpoints-section">
          <h4>
            <span className="section-icon">📍</span>
            Checkpoints
            <span className="section-count">({sortedCheckpoints.length})</span>
          </h4>
          {sortedCheckpoints.length === 0 ? (
            <p className="empty-message">
              {readOnly
                ? 'No checkpoints added.'
                : 'Use the Waypoint tool to add time-scheduled stops.'}
            </p>
          ) : (
            <div className="checkpoints-list">
              {sortedCheckpoints.map((checkpoint, index) => (
                <CheckpointItem
                  key={checkpoint.id}
                  feature={checkpoint}
                  selected={checkpoint.id === selectedFeatureId}
                  onSelect={onSelectFeature}
                  onUpdate={onUpdateFeature}
                  onUpdateWithCascade={onUpdateFeatureWithCascade}
                  onDelete={onDeleteFeature}
                  onCenter={onCenterFeature}
                  onFlyTo={onFlyToFeature}
                  readOnly={readOnly}
                  hasSubsequentCheckpoints={index < sortedCheckpoints.length - 1}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Other Features (markers, routes, areas) - manually ordered */}
        <section className="other-features-section">
          <h4>
            <span className="section-icon">📌</span>
            Other Features
            <span className="section-count">({sortedOtherFeatures.length})</span>
          </h4>
          {sortedOtherFeatures.length === 0 ? (
            <p className="empty-message">
              {readOnly
                ? 'No other features added.'
                : 'Add markers, routes, and areas.'}
            </p>
          ) : (
            <div className="features-list">
              {sortedOtherFeatures.map((feature, index) => (
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
                    onDoubleClick={onFlyToFeature}
                    readOnly={readOnly}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Reference Tracks */}
        <section className="tracks-section">
          <div className="section-header-row">
            <h4>
              <span className="section-icon">🛤️</span>
              Reference Tracks
              <span className="section-count">({referenceTracks?.length || 0})</span>
            </h4>
            {!readOnly && (
              <label className="add-gpx-btn" title="Upload GPX file as reference track">
                <span>+ Add GPX</span>
                <input
                  type="file"
                  accept=".gpx"
                  onChange={(e) => {
                    if (e.target.files?.[0] && onAddReferenceTrack) {
                      onAddReferenceTrack(e.target.files[0]);
                      e.target.value = ''; // Reset input
                    }
                  }}
                  hidden
                />
              </label>
            )}
          </div>
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
                  onToggleVisibility={onToggleTrackVisibility}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};

export default ItineraryPanel;
