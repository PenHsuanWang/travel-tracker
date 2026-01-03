// client/src/components/panels/ItineraryPanel.js
/**
 * ItineraryPanel - Side panel showing plan features and reference tracks.
 * 
 * Unified Marker System (PRD v1.1):
 * The panel has THREE sections based on time attribute presence:
 * 1. Timeline - Point features with estimated_arrival (time-sorted)
 * 2. Features List - Point features without time + Routes/Areas (reference items)
 * 3. Reference Tracks - Read-only GPX baselines
 */
import React, { useState, useCallback, useMemo } from 'react';
import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';
import MarkerCard from './MarkerCard';
import DailyProfileCard from './DailyProfileCard';
import DailyHazardCard from './DailyHazardCard';
import {
  FEATURE_CATEGORY,
  getCategoryIcon,
  getCategoryLabel,
  SEMANTIC_TYPE,
} from '../../services/planService';
import { ICON_CONFIG } from '../../utils/mapIcons';
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
    // Priority 0: Hazard Subtype
    if (feature.properties?.semantic_type === 'hazard' && feature.properties?.hazard_subtype) {
       const subtype = feature.properties.hazard_subtype;
       if (subtype === 'river_tracing') return '🌊';
       if (subtype === 'rock_climbing') return '🧗';
       return '⚠️';
    }

    // Priority 1: Semantic Type (if specific)
    const semanticType = feature.properties?.semantic_type;
    if (semanticType && semanticType !== SEMANTIC_TYPE.GENERIC && ICON_CONFIG[semanticType]) {
      return ICON_CONFIG[semanticType].emoji;
    }

    // Priority 2: Category
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
            {feature.properties?.difficulty_grade && (
              <span style={{ fontSize: '0.85em', color: '#6b7280', marginLeft: '6px' }}>
                ({feature.properties.difficulty_grade})
              </span>
            )}
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

// UI-04: Integrated Day Summary Editor
const EmbeddedDaySummary = ({ dayNumber, summary, onChange, readOnly }) => {
  const handleFieldChange = (field, value) => {
    if (onChange) {
      onChange(dayNumber, field, value);
    }
  };

  const overviewValue = summary?.route_summary || '';
  const conditionsValue = summary?.conditions || '';

  if (readOnly && !overviewValue && !conditionsValue) {
    return null;
  }

  return (
    <div className="day-summary-embedded p-3 bg-gray-50 border-b border-gray-100">
      {!readOnly ? (
        <div className="day-summary-fields flex flex-col gap-2">
          <textarea
            className="w-full text-sm border rounded p-1"
            placeholder={`Day ${dayNumber} Overview (Route, key moves...)`}
            rows="2"
            value={overviewValue}
            onChange={(e) => handleFieldChange('route_summary', e.target.value)}
          />
          <textarea
            className="w-full text-sm border rounded p-1"
            placeholder="Conditions (Weather, water...)"
            rows="1"
            value={conditionsValue}
            onChange={(e) => handleFieldChange('conditions', e.target.value)}
          />
        </div>
      ) : (
        <div className="day-summary-readonly text-sm text-gray-700">
          {overviewValue && <p className="mb-1"><strong>Overview:</strong> {overviewValue}</p>}
          {conditionsValue && <p><strong>Conditions:</strong> {conditionsValue}</p>}
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

const FeatureGroup = ({ title, icon, count, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (count === 0) return null;

  return (
    <div className="feature-group" style={{ marginBottom: '8px' }}>
      <div 
        className="feature-group-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '8px 12px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '6px', 
          marginBottom: '4px', 
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '12px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</span>
          <span>{icon} {title}</span>
        </div>
        <span className="section-count" style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '10px' }}>{count}</span>
      </div>
      {isOpen && (
        <div className="feature-group-content" style={{ paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const ItineraryPanel = ({
  features,
  referenceTracks,
  planStartDate, // Added prop for day grouping
  selectedFeatureId,
  onSelectFeature,
  onUpdateFeature,
  onUpdateFeatureWithCascade, // Optional: for cascade time updates
  onDeleteFeature,
  onReorderFeatures,
  onCenterFeature,
  onFlyToFeature, // FE-06: Navigate map to feature with flyTo + flash
  onEditFeature, // Open feature popup for editing
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

  // =========================================================================
  // Unified Marker System (PRD v1.1): Split by TIME presence, not CATEGORY
  // =========================================================================
  const { timelineItems, referenceItems, nonPointFeatures } = useMemo(() => {
    const timeline = [];
    const reference = [];
    const nonPoints = [];
    
    featuresArray.forEach((feature) => {
      const geometryType = feature.geometry?.type;
      
      // Non-point features (Routes, Areas) → always go to non-point section
      if (geometryType !== 'Point') {
        nonPoints.push(feature);
        return;
      }
      
      // Point features: split by estimated_arrival presence (THE SWITCH)
      const hasTime = feature.properties?.estimated_arrival != null;
      
      if (hasTime) {
        timeline.push(feature);   // Scheduled → Timeline
      } else {
        reference.push(feature);  // Unscheduled → Features List
      }
    });
    
    return { timelineItems: timeline, referenceItems: reference, nonPointFeatures: nonPoints };
  }, [featuresArray]);

  // Sort timeline items by estimated_arrival (ascending) - replaces sortedCheckpoints
  const sortedTimelineItems = useMemo(() => {
    return [...timelineItems].sort((a, b) => {
      const aTime = a.properties?.estimated_arrival;
      const bTime = b.properties?.estimated_arrival;
      if (aTime && bTime) {
        return new Date(aTime) - new Date(bTime);
      }
      return 0;
    });
  }, [timelineItems]);

  // Backward compatibility: alias for existing code that uses checkpoints
  const checkpoints = timelineItems;
  const sortedCheckpoints = sortedTimelineItems;
  const otherFeatures = [...referenceItems, ...nonPointFeatures];

  // Group checkpoints by Day (based on planStartDate)
  const groupedCheckpoints = useMemo(() => {
    if (!planStartDate) {
      // Fallback: if no planStartDate, just return a single group or treat as flat
      // But keeping consistent structure is better.
      return [{
        label: 'All Checkpoints',
        subLabel: '',
        dayNum: 0,
        items: sortedCheckpoints
      }];
    }

    const groupMap = new Map();
    const groupList = [];
    const startDate = parseISO(planStartDate);
    const validStartDate = isValid(startDate);

    sortedCheckpoints.forEach(cp => {
      const arrival = cp.properties?.estimated_arrival;
      let key = 'Unscheduled';
      let label = 'Unscheduled';
      let subLabel = '';
      let dayNum = 999999; // Sort unscheduled last

      if (arrival && validStartDate) {
        const cpDate = parseISO(arrival);
        if (isValid(cpDate)) {
          // Calculate day offset
          dayNum = differenceInCalendarDays(cpDate, startDate) + 1;
          label = `Day ${dayNum}`;
          subLabel = format(cpDate, 'MMM dd');
          key = `${dayNum}_${subLabel}`;
        }
      }

      if (!groupMap.has(key)) {
        const group = {
          key,
          label,
          subLabel,
          dayNum,
          items: []
        };
        groupMap.set(key, group);
        groupList.push(group);
      }
      groupMap.get(key).items.push(cp);
    });

    // Sort groups: chronological days first, then Unscheduled
    groupList.sort((a, b) => a.dayNum - b.dayNum);

    return groupList;
  }, [sortedCheckpoints, planStartDate]);

  // Sort other features by order_index (for non-point features like routes/areas)
  const sortedOtherFeatures = useMemo(() => {
    return [...nonPointFeatures].sort((a, b) => {
      const aOrder = a.properties?.order_index ?? Infinity;
      const bOrder = b.properties?.order_index ?? Infinity;
      return aOrder - bOrder;
    });
  }, [nonPointFeatures]);

  // Group reference items (Point features without time) by semantic type
  const groupedFeatures = useMemo(() => {
    const groups = {
      hazard: [],
      water: [],
      camp: [],
      signal: [],
      checkin: [],
      other: []
    };

    // Only include Point features that have no time (referenceItems)
    referenceItems.forEach(feature => {
      const type = feature.properties?.semantic_type;
      if (type === 'hazard') groups.hazard.push(feature);
      else if (type === 'water') groups.water.push(feature);
      else if (type === 'camp') groups.camp.push(feature);
      else if (type === 'signal') groups.signal.push(feature);
      else if (type === 'checkin') groups.checkin.push(feature);
      else groups.other.push(feature);
    });
    
    // Also add non-point features to 'other' group
    sortedOtherFeatures.forEach(feature => {
      groups.other.push(feature);
    });

    return groups;
  }, [referenceItems, sortedOtherFeatures]);

  // Refactored to handle dynamic updates for embedded summaries
  const handleDaySummaryChange = (dayNumber, field, value) => {
    if (!onUpdateDaySummaries) return;
    const base = Array.isArray(daySummaries) ? [...daySummaries] : [];
    const existingIndex = base.findIndex(d => d.day_number === dayNumber);
    
    if (existingIndex >= 0) {
      base[existingIndex] = { ...base[existingIndex], [field]: value };
    } else {
      base.push({
        day_number: dayNumber,
        title: `Day ${dayNumber}`,
        route_summary: '',
        conditions: '',
        [field]: value,
      });
    }
    onUpdateDaySummaries(base);
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
          <p className="panel-subtitle">Unified Marker View</p>
        </div>
        <span className="feature-count">
          {featuresArray.length} {featuresArray.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="panel-content">
        {/* Section 1: Timeline (Scheduled Items with estimated_arrival) */}
        <section className="checkpoints-section timeline-section">
          <div className="section-header-row">
            <h4>
              <span className="section-icon">📅</span>
              Timeline
              <span className="section-count">({sortedCheckpoints.length})</span>
            </h4>
            {!readOnly && daySummariesDirty && (
               <button
                 className="save-day-btn"
                 onClick={() => onSaveDaySummaries?.()}
                 disabled={savingDaySummaries}
                 title="Save itinerary changes"
                 style={{ marginLeft: 'auto', fontSize: '11px', padding: '2px 8px' }}
               >
                 {savingDaySummaries ? 'Saving...' : 'Save Notes' }
               </button>
            )}
          </div>
          {sortedCheckpoints.length === 0 ? (
            <p className="empty-message">
              {readOnly
                ? 'No scheduled items.'
                : 'Place markers on map and use 📅+ to add them to the timeline.'}
            </p>
          ) : (
            <div className="checkpoints-list">
              {groupedCheckpoints.map((group, groupIndex) => (
                <div key={group.key || groupIndex} className="day-group-container mb-4">
                  {/* Day Header */}
                  {planStartDate ? (
                    <div className="day-group-header sticky top-0 z-10 bg-gray-100 p-2 font-bold border-b flex justify-between">
                      <span>{group.label}</span>
                      <span className="text-gray-500 font-normal">{group.subLabel}</span>
                    </div>
                  ) : (
                     /* If no plan start date, show simplified header or nothing if 'All Checkpoints' */
                     group.label !== 'All Checkpoints' && (
                       <div className="day-group-header sticky top-0 z-10 bg-gray-100 p-2 font-bold border-b">
                         <span>{group.label}</span>
                       </div>
                     )
                  )}

                  {/* UI-04: Embedded Day Summary & Daily Profile */}
                  {/* Only show for valid Day groups (not Unscheduled 999999) */}
                  {group.dayNum >= 0 && group.dayNum < 900000 && (
                    <>
                      {/* Feature: Daily Profile Visualization */}
                      <DailyProfileCard dailyCheckpoints={group.items} />
                      
                      {/* Feature: Daily Hazard Statistics */}
                      <DailyHazardCard dailyCheckpoints={group.items} />
                      
                      <EmbeddedDaySummary
                        dayNumber={group.dayNum}
                        summary={daySummaries.find(d => d.day_number === group.dayNum)}
                        onChange={handleDaySummaryChange}
                        readOnly={readOnly}
                      />
                    </>
                  )}

                  {/* Items container - Using MarkerCard (Unified Marker System) */}
                  <div className={planStartDate ? "day-items border-l-2 border-green-200 ml-2 pl-2" : "day-items"}>
                    {group.items.map((item, index) => (
                      <MarkerCard
                        key={item.id}
                        feature={item}
                        selected={item.id === selectedFeatureId}
                        isScheduled={true}
                        onSelect={onSelectFeature}
                        onUpdate={onUpdateFeature}
                        onUpdateWithCascade={onUpdateFeatureWithCascade}
                        onDelete={onDeleteFeature}
                        onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                        readOnly={readOnly}
                        showDeltaTime={index > 0}
                        previousArrival={index > 0 ? group.items[index - 1].properties?.estimated_arrival : null}
                        hasSubsequentItems={index < group.items.length - 1}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Features List (Reference Items - no time) */}
        <section className="other-features-section reference-section">
          <h4>
            <span className="section-icon">📌</span>
            Features List
            <span className="section-count">({referenceItems.length})</span>
          </h4>
          {referenceItems.length === 0 ? (
            <p className="empty-message">
              {readOnly
                ? 'No reference markers.'
                : 'Place markers on map. Use 📅+ to add them to timeline.'}
            </p>
          ) : (
            <div className="features-list-grouped">
              <FeatureGroup title="HAZARDS" icon={ICON_CONFIG.hazard.emoji} count={groupedFeatures.hazard.length}>
                {groupedFeatures.hazard.map(feature => (
                  <MarkerCard
                    key={feature.id}
                    feature={feature}
                    selected={feature.id === selectedFeatureId}
                    isScheduled={false}
                    onSelect={onSelectFeature}
                    onUpdate={onUpdateFeature}
                    onDelete={onDeleteFeature}
                    onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                    readOnly={readOnly}
                  />
                ))}
              </FeatureGroup>

              <FeatureGroup title="WATER SOURCES" icon={ICON_CONFIG.water.emoji} count={groupedFeatures.water.length}>
                {groupedFeatures.water.map(feature => (
                  <MarkerCard
                    key={feature.id}
                    feature={feature}
                    selected={feature.id === selectedFeatureId}
                    isScheduled={false}
                    onSelect={onSelectFeature}
                    onUpdate={onUpdateFeature}
                    onDelete={onDeleteFeature}
                    onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                    readOnly={readOnly}
                  />
                ))}
              </FeatureGroup>

              <FeatureGroup title="CAMPSITES" icon={ICON_CONFIG.camp.emoji} count={groupedFeatures.camp.length}>
                {groupedFeatures.camp.map(feature => (
                  <MarkerCard
                    key={feature.id}
                    feature={feature}
                    selected={feature.id === selectedFeatureId}
                    isScheduled={false}
                    onSelect={onSelectFeature}
                    onUpdate={onUpdateFeature}
                    onDelete={onDeleteFeature}
                    onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                    readOnly={readOnly}
                  />
                ))}
              </FeatureGroup>

              <FeatureGroup title="SIGNALS" icon={ICON_CONFIG.signal.emoji} count={groupedFeatures.signal.length}>
                {groupedFeatures.signal.map(feature => (
                  <MarkerCard
                    key={feature.id}
                    feature={feature}
                    selected={feature.id === selectedFeatureId}
                    isScheduled={false}
                    onSelect={onSelectFeature}
                    onUpdate={onUpdateFeature}
                    onDelete={onDeleteFeature}
                    onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                    readOnly={readOnly}
                  />
                ))}
              </FeatureGroup>

              <FeatureGroup title="CHECK-INS" icon={ICON_CONFIG.checkin.emoji} count={groupedFeatures.checkin.length}>
                {groupedFeatures.checkin.map(feature => (
                  <MarkerCard
                    key={feature.id}
                    feature={feature}
                    selected={feature.id === selectedFeatureId}
                    isScheduled={false}
                    onSelect={onSelectFeature}
                    onUpdate={onUpdateFeature}
                    onDelete={onDeleteFeature}
                    onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                    readOnly={readOnly}
                  />
                ))}
              </FeatureGroup>

              <FeatureGroup title="OTHER MARKERS" icon={ICON_CONFIG.generic.emoji} count={groupedFeatures.other.length}>
                {groupedFeatures.other.map(feature => (
                  feature.geometry?.type === 'Point' ? (
                    <MarkerCard
                      key={feature.id}
                      feature={feature}
                      selected={feature.id === selectedFeatureId}
                      isScheduled={false}
                      onSelect={onSelectFeature}
                      onUpdate={onUpdateFeature}
                      onDelete={onDeleteFeature}
                      onNavigate={onCenterFeature}
                        onEdit={onEditFeature}
                      readOnly={readOnly}
                    />
                  ) : (
                    <FeatureItem
                      key={feature.id}
                      feature={feature}
                      selected={feature.id === selectedFeatureId}
                      onSelect={onSelectFeature}
                      onUpdate={onUpdateFeature}
                      onDelete={onDeleteFeature}
                      onDoubleClick={onFlyToFeature}
                      readOnly={readOnly}
                    />
                  )
                ))}
              </FeatureGroup>
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
