// client/src/components/panels/ItineraryPanel.js
/**
 * ItineraryPanel - Side panel showing plan features and reference tracks.
 * 
 * Unified Marker System (PRD v1.1):
 * The panel has THREE sections based on time attribute presence:
 * 1. Timeline - Point features with estimated_arrival (time-sorted)
 * 2. Features List - Point features without time + Routes/Areas (reference items)
 * 3. Reference Tracks - Read-only GPX baselines
 * 
 * Design: Aligned with TripDetailPage TimelinePanel (Visual Unification)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';
import { Card, CardBody } from '../common/Card/Card';
import MarkerCard from './MarkerCard';
import RouteCard from './RouteCard';
import AreaCard from './AreaCard';
import DailyProfileCard from './DailyProfileCard';
import DailyHazardCard from './DailyHazardCard';
import {
  getCategoryIcon,
  getCategoryLabel,
  SEMANTIC_TYPE,
} from '../../services/planService';
import { getImageUrl } from '../../services/api';
import { ICON_CONFIG } from '../../utils/mapIcons';
import './ItineraryPanel.css';

// Helper: derive arrival time from multiple possible fields
const getArrivalTime = (feature) => {
  if (!feature) return null;
  const props = feature.properties || {};
  return (
    props.estimated_arrival ||
    props.arrival_time ||
    props.start_time ||
    props.startTime ||
    props.departure_time ||
    props.time ||
    null
  );
};

/**
 * FeatureItem - Generic item for non-checkpoint features (markers, routes, areas).
 * Refactored to use Card component.
 */
const FeatureItem = ({
  feature,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onDoubleClick,
  readOnly,
  members,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  const category = feature.properties?.category || 'marker';
  const creator = members?.find(m => String(m.id) === String(feature.properties?.created_by));

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

    // Priority 1: Semantic Type
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
    if (type === 'Point') return '📌';
    if (type === 'LineString') return '〰️';
    if (type === 'Polygon') {
      if (shapeType === 'rectangle') return '▭';
      if (shapeType === 'circle') return '◯';
      return '⬡';
    }
    return '•';
  };

  const getFeatureLabel = () => {
    if (feature.properties?.name) return feature.properties.name;
    if (category) return getCategoryLabel(category);
    const type = feature.geometry?.type;
    if (type === 'Point') return 'Marker';
    if (type === 'LineString') return 'Route';
    if (type === 'Polygon') return 'Area';
    return 'Feature';
  };

  return (
    <Card
      variant="plan"
      selected={selected}
      onClick={() => onSelect(feature.id)}
      onDoubleClick={handleDoubleClick}
      className="mb-2 group"
      title="Double-click to navigate on map"
    >
      <CardBody className="p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xl flex-shrink-0">{getFeatureIcon()}</span>
          
          {isEditing ? (
            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 text-sm border rounded px-1 py-0.5"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <button onClick={handleSaveEdit} className="text-green-600 font-bold hover:bg-green-50 rounded px-1">✓</button>
              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 px-1">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-slate-700 truncate" onDoubleClick={handleStartEdit}>
                {getFeatureLabel()}
              </span>
              {feature.properties?.difficulty_grade && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  ({feature.properties.difficulty_grade})
                </span>
              )}
            </div>
          )}
        </div>

        {creator && (
            <img 
                src={creator.avatar_url ? (creator.avatar_url.startsWith('http') ? creator.avatar_url : getImageUrl(creator.avatar_url)) : '/default-avatar.svg'} 
                alt={creator.username}
                title={`Created by ${creator.username}`}
                className="w-5 h-5 rounded-full border border-white shadow-sm flex-shrink-0 ml-1"
            />
        )}

        {!readOnly && !isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Add to schedule (defaults: Route=1h, Area=30m)
                const now = new Date().toISOString();
                const isRoute = feature.geometry?.type === 'LineString';
                const defaultDuration = isRoute ? 60 : 30;
                onUpdate(feature.id, {
                  properties: {
                    ...feature.properties,
                    estimated_arrival: now,
                    estimated_duration_minutes: defaultDuration,
                  },
                });
              }}
              className="p-1.5 text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 rounded"
              title="Add to schedule"
            >
              📅+
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              title="Edit name"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(feature.id);
              }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
      </CardBody>
    </Card>
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
    <div className="mb-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Day Summary</h5>
      {!readOnly ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full text-sm border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)]"
            placeholder={`Day ${dayNumber} Overview (Route, key moves...)`}
            rows="2"
            value={overviewValue}
            onChange={(e) => handleFieldChange('route_summary', e.target.value)}
          />
          <textarea
            className="w-full text-sm border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)]"
            placeholder="Conditions (Weather, water...)"
            rows="1"
            value={conditionsValue}
            onChange={(e) => handleFieldChange('conditions', e.target.value)}
          />
        </div>
      ) : (
        <div className="text-sm text-slate-700">
          {overviewValue && <p className="mb-1"><strong>Overview:</strong> {overviewValue}</p>}
          {conditionsValue && <p><strong>Conditions:</strong> {conditionsValue}</p>}
        </div>
      )}
    </div>
  );
};

// UI-03: Reference track item with visibility toggles
const ReferenceTrackItem = ({ track, onRemove, onToggleVisibility, readOnly }) => {
  const showTrack = track.showTrack !== false; // Default true
  const showWaypoints = track.showWaypoints === true; // Default false
  
  return (
    <Card variant="plan" className="mb-2 group">
      <CardBody className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-lg">🛤️</span>
          <span className="font-medium text-slate-700 truncate" title={track.display_name || track.filename}>
            {track.display_name || track.filename}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            className={`p-1.5 rounded transition-colors ${showTrack ? 'text-[var(--color-brand)] bg-[var(--color-brand-light)]' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => onToggleVisibility?.(track.id, 'showTrack', !showTrack)}
            title={showTrack ? 'Hide track line' : 'Show track line'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <button
            className={`p-1.5 rounded transition-colors ${showWaypoints ? 'text-[var(--color-brand)] bg-[var(--color-brand-light)]' : 'text-slate-400 hover:text-slate-600'}`}
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
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded ml-1"
              onClick={() => onRemove(track.id)}
              title="Remove track"
            >
              ✕
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

const FeatureGroup = ({ title, icon, count, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (count === 0) return null;

  return (
    <div className="mb-4">
      <div 
        className="flex items-center justify-between py-2 px-1 cursor-pointer select-none group" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide group-hover:text-slate-700">
          <span className="text-[10px] transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          <span>{icon} {title}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      {isOpen && (
        <div className="pl-2 flex flex-col gap-1 mt-1">
          {children}
        </div>
      )}
    </div>
  );
};

const ItineraryPanel = ({
  features,
  referenceTracks,
  planStartDate,
  selectedFeatureId,
  onSelectFeature,
  onUpdateFeature,
  onUpdateFeatureWithCascade,
  onDeleteFeature,
  onReorderFeatures,
  onCenterFeature,
  onFlyToFeature,
  onEditFeature,
  onAddReferenceTrack,
  onRemoveReferenceTrack,
  onToggleTrackVisibility,
  width,
  onWidthChange,
  daySummaries = [],
  onUpdateDaySummaries,
  onSaveDaySummaries,
  daySummariesDirty,
  savingDaySummaries,
  readOnly,
  members,
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Ensure features is an array
  const featuresArray = useMemo(() => {
    return Array.isArray(features) ? features : (features?.features || []);
  }, [features]);

  const { timelineItems, referenceItems, nonPointFeatures } = useMemo(() => {
    const timeline = [];
    const reference = [];
    const nonPoints = [];
    
    featuresArray.forEach((feature) => {
      const geometryType = feature.geometry?.type;
      const arrival = getArrivalTime(feature);
      const hasTime = (feature.properties?.has_time_stamp === true) || (arrival != null);

      if (hasTime) {
        timeline.push(feature);
      } else {
        if (geometryType === 'Point') {
          reference.push(feature);
        } else {
          nonPoints.push(feature);
        }
      }
    });
    
    return { timelineItems: timeline, referenceItems: reference, nonPointFeatures: nonPoints };
  }, [featuresArray]);

  const sortedCheckpoints = useMemo(() => {
    return [...timelineItems].sort((a, b) => {
      const aTime = getArrivalTime(a);
      const bTime = getArrivalTime(b);
      if (aTime && bTime) {
        return new Date(aTime) - new Date(bTime);
      }
      return 0;
    });
  }, [timelineItems]);

  const otherFeatures = [...referenceItems, ...nonPointFeatures];

  const effectiveStartDate = useMemo(() => {
    const explicit = planStartDate ? parseISO(planStartDate) : null;
    if (explicit && isValid(explicit)) return explicit;

    let earliest = null;
    sortedCheckpoints.forEach((item) => {
      const arrival = getArrivalTime(item);
      if (!arrival) return;
      const dt = parseISO(arrival);
      if (!isValid(dt)) return;
      if (!earliest || dt < earliest) {
        earliest = dt;
      }
    });
    return earliest;
  }, [planStartDate, sortedCheckpoints]);

  const groupedCheckpoints = useMemo(() => {
    const hasStart = !!effectiveStartDate;

    if (!hasStart) {
      return [{
        label: 'All Checkpoints',
        subLabel: '',
        dayNum: 0,
        items: sortedCheckpoints,
      }];
    }

    const groupMap = new Map();
    const groupList = [];

    sortedCheckpoints.forEach((cp) => {
      const arrival = getArrivalTime(cp);
      let key = 'Unscheduled';
      let label = 'Unscheduled';
      let subLabel = '';
      let dayNum = 999999;

      if (arrival) {
        const cpDate = parseISO(arrival);
        if (isValid(cpDate) && isValid(effectiveStartDate)) {
          dayNum = differenceInCalendarDays(cpDate, effectiveStartDate) + 1;
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
          items: [],
        };
        groupMap.set(key, group);
        groupList.push(group);
      }
      groupMap.get(key).items.push(cp);
    });

    groupList.sort((a, b) => a.dayNum - b.dayNum);

    return groupList;
  }, [sortedCheckpoints, effectiveStartDate]);

  const sortedOtherFeatures = useMemo(() => {
    return [...nonPointFeatures].sort((a, b) => {
      const aOrder = a.properties?.order_index ?? Infinity;
      const bOrder = b.properties?.order_index ?? Infinity;
      return aOrder - bOrder;
    });
  }, [nonPointFeatures]);

  const groupedFeatures = useMemo(() => {
    const groups = {
      hazard: [],
      water: [],
      camp: [],
      signal: [],
      checkin: [],
      other: []
    };

    referenceItems.forEach(feature => {
      const type = feature.properties?.semantic_type;
      if (type === 'hazard') groups.hazard.push(feature);
      else if (type === 'water') groups.water.push(feature);
      else if (type === 'camp') groups.camp.push(feature);
      else if (type === 'signal') groups.signal.push(feature);
      else if (type === 'checkin') groups.checkin.push(feature);
      else groups.other.push(feature);
    });
    
    sortedOtherFeatures.forEach(feature => {
      groups.other.push(feature);
    });

    return groups;
  }, [referenceItems, sortedOtherFeatures]);

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
    <div className="flex flex-col bg-slate-50 overflow-hidden relative border-l border-slate-200 shadow-xl z-20" style={{ width, height: '100%' }}>
      {/* Resize Handle */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--color-brand)] transition-colors z-50"
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <div className="p-6 pb-0 flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">Itinerary</h1>
          <p className="text-sm text-slate-500 font-medium">Unified Marker View</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            {!readOnly && daySummariesDirty && (
                <button
                    className="text-xs font-bold text-white bg-[var(--color-brand)] px-2 py-1 rounded shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors"
                    onClick={() => onSaveDaySummaries?.()}
                    disabled={savingDaySummaries}
                >
                    {savingDaySummaries ? 'Saving...' : 'Save Notes' }
                </button>
            )}
             <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-full shadow-sm">
                {featuresArray.length} items
            </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
        {/* Section 1: Timeline */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              Timeline
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand)]">
                {sortedCheckpoints.length}
            </span>
          </div>

          {sortedCheckpoints.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <span className="text-2xl block mb-2">📅</span>
                <p className="text-sm text-slate-500">
                    {readOnly ? 'No scheduled items.' : 'Place markers on map and use 📅+ to add them.'}
                </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedCheckpoints.map((group, groupIndex) => (
                <div key={group.key || groupIndex} className="relative">
                  {/* Day Header */}
                  {effectiveStartDate && group.label !== 'All Checkpoints' && (
                    <div className="flex items-baseline justify-between mb-3 pb-1 border-b border-slate-200">
                      <span className="font-bold text-slate-800">{group.label}</span>
                      <span className="text-sm text-slate-500 font-medium">{group.subLabel}</span>
                    </div>
                  )}

                  <div className="pl-4 border-l-2 border-slate-200 space-y-3">
                      {/* Day Stats */}
                      {group.dayNum >= 0 && group.dayNum < 900000 && (
                        <>
                          <DailyProfileCard dailyCheckpoints={group.items} />
                          <DailyHazardCard dailyCheckpoints={group.items} />
                        </>
                      )}
                      
                      {/* Route/Area Cards - Always show if present in this group */}
                      <div className="space-y-2 mb-3">
                        {group.items
                          .filter(item => {
                            const t = item.geometry?.type?.toLowerCase();
                            return t === 'linestring' || t === 'multilinestring' || t === 'polygon' || t === 'multipolygon';
                          })
                          .map(item => {
                            const arrival = getArrivalTime(item);
                            const itemForRender = arrival && !item.properties?.estimated_arrival
                              ? { ...item, properties: { ...item.properties, estimated_arrival: arrival } }
                              : item;
                            const commonProps = {
                              feature: itemForRender,
                              selected: item.id === selectedFeatureId,
                              isScheduled: true,
                              onSelect: onSelectFeature,
                              onUpdate: onUpdateFeature,
                              onDelete: onDeleteFeature,
                              onNavigate: onCenterFeature,
                              onEdit: onEditFeature,
                              readOnly,
                            };
                            if (item.geometry?.type?.toLowerCase().includes('line')) {
                              return <RouteCard key={item.id} {...commonProps} />;
                            }
                            return <AreaCard key={item.id} {...commonProps} />;
                          })
                        }
                      </div>

                      {/* Day Summary */}
                      {group.dayNum >= 0 && group.dayNum < 900000 && (
                          <EmbeddedDaySummary
                            dayNumber={group.dayNum}
                            summary={daySummaries.find(d => d.day_number === group.dayNum)}
                            onChange={handleDaySummaryChange}
                            readOnly={readOnly}
                          />
                      )}

                      {/* Point Markers */}
                      <div className="space-y-2">
                        {group.items
                          .filter(item => {
                            const t = item.geometry?.type?.toLowerCase();
                            return t === 'point' || t === 'multipoint';
                          })
                          .map((item, index, filteredItems) => {
                            const arrival = getArrivalTime(item);
                            const itemForRender = arrival && !item.properties?.estimated_arrival
                              ? { ...item, properties: { ...item.properties, estimated_arrival: arrival } }
                              : item;

                            return (
                              <MarkerCard
                                key={item.id}
                                feature={itemForRender}
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
                                previousArrival={index > 0 ? getArrivalTime(filteredItems[index - 1]) : null}
                                hasSubsequentItems={index < filteredItems.length - 1}
                                members={members}
                              />
                            );
                          })}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Features List */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              Features List
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-200 text-slate-600">
                {otherFeatures.length}
            </span>
          </div>
            
          {otherFeatures.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <span className="text-2xl block mb-2">📌</span>
                <p className="text-sm text-slate-500">
                   {readOnly ? 'No features.' : 'Place markers on map.'}
                </p>
            </div>
          ) : (
            <div className="space-y-2">
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
                    members={members}
                  />
                ))}
              </FeatureGroup>

              <FeatureGroup title="WATER" icon={ICON_CONFIG.water.emoji} count={groupedFeatures.water.length}>
                {groupedFeatures.water.map(feature => (
                  <MarkerCard key={feature.id} feature={feature} selected={feature.id === selectedFeatureId} isScheduled={false} onSelect={onSelectFeature} onUpdate={onUpdateFeature} onDelete={onDeleteFeature} onNavigate={onCenterFeature} onEdit={onEditFeature} readOnly={readOnly} members={members} />
                ))}
              </FeatureGroup>

              <FeatureGroup title="CAMPS" icon={ICON_CONFIG.camp.emoji} count={groupedFeatures.camp.length}>
                {groupedFeatures.camp.map(feature => (
                  <MarkerCard key={feature.id} feature={feature} selected={feature.id === selectedFeatureId} isScheduled={false} onSelect={onSelectFeature} onUpdate={onUpdateFeature} onDelete={onDeleteFeature} onNavigate={onCenterFeature} onEdit={onEditFeature} readOnly={readOnly} members={members} />
                ))}
              </FeatureGroup>

               <FeatureGroup title="SIGNALS" icon={ICON_CONFIG.signal.emoji} count={groupedFeatures.signal.length}>
                {groupedFeatures.signal.map(feature => (
                  <MarkerCard key={feature.id} feature={feature} selected={feature.id === selectedFeatureId} isScheduled={false} onSelect={onSelectFeature} onUpdate={onUpdateFeature} onDelete={onDeleteFeature} onNavigate={onCenterFeature} onEdit={onEditFeature} readOnly={readOnly} members={members} />
                ))}
              </FeatureGroup>

               <FeatureGroup title="CHECK-INS" icon={ICON_CONFIG.checkin.emoji} count={groupedFeatures.checkin.length}>
                {groupedFeatures.checkin.map(feature => (
                  <MarkerCard key={feature.id} feature={feature} selected={feature.id === selectedFeatureId} isScheduled={false} onSelect={onSelectFeature} onUpdate={onUpdateFeature} onDelete={onDeleteFeature} onNavigate={onCenterFeature} onEdit={onEditFeature} readOnly={readOnly} members={members} />
                ))}
              </FeatureGroup>

              <FeatureGroup title="OTHER" icon={ICON_CONFIG.generic.emoji} count={groupedFeatures.other.length}>
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
                      members={members}
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
                      members={members}
                    />
                  )
                ))}
              </FeatureGroup>
            </div>
          )}
        </section>

        {/* Section 3: Reference Tracks */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              Reference Tracks
            </h2>
            <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-200 text-slate-600">
                    {referenceTracks?.length || 0}
                </span>
                {!readOnly && (
                  <label className="cursor-pointer text-[var(--color-brand)] hover:text-[var(--color-brand-hover)]" title="Upload GPX file">
                    <span className="text-xl">⊕</span>
                    <input
                      type="file"
                      accept=".gpx"
                      onChange={(e) => {
                        if (e.target.files?.[0] && onAddReferenceTrack) {
                          onAddReferenceTrack(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                      hidden
                    />
                  </label>
                )}
            </div>
          </div>

          {(!referenceTracks || referenceTracks.length === 0) ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <span className="text-2xl block mb-2">🛤️</span>
                <p className="text-sm text-slate-500">
                    {readOnly ? 'No tracks.' : 'Add GPX tracks as reference.'}
                </p>
            </div>
          ) : (
            <div className="space-y-2">
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
    </div>
  );
};

export default ItineraryPanel;