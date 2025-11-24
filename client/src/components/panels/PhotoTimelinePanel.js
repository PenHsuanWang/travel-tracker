// client/src/components/panels/PhotoTimelinePanel.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import '../../styles/PhotoTimelinePanel.css';

const sortChronologically = (a, b) => {
  if (a?.capturedDate && b?.capturedDate) {
    return a.capturedDate.getTime() - b.capturedDate.getTime();
  }
  if (a?.capturedDate) return -1;
  if (b?.capturedDate) return 1;
  return (a?.fileName || '').localeCompare(b?.fileName || '');
};

const formatDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Helper: Get time of day period
const getTimeOfDay = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

const getTimeOfDayLabel = (period) => {
  const labels = {
    morning: '🌅 上午時段',
    afternoon: '☀️ 下午時段',
    evening: '🌆 傍晚時段',
    unknown: '⏰ 未知時段',
  };
  return labels[period] || labels.unknown;
};

// Build groups by day and time period
const buildGroups = (photos) => {
  const groups = [];
  let dayCounter = 0;
  let lastDayKey = null;

  photos.forEach((photo) => {
    const dayKey = photo.capturedDate ? photo.capturedDate.toISOString().slice(0, 10) : 'unknown';
    const timeOfDay = getTimeOfDay(photo.capturedDate);
    
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      const isUnknown = dayKey === 'unknown';
      if (!isUnknown) {
        dayCounter += 1;
      }
      groups.push({
        id: dayKey,
        label: isUnknown ? 'Unknown time' : `Day ${dayCounter}`,
        dateLabel: isUnknown ? 'Ungrouped captures' : formatDate(photo.capturedDate),
        periods: {},
        isUnknown,
      });
    }
    
    const currentGroup = groups[groups.length - 1];
    if (!currentGroup.periods[timeOfDay]) {
      currentGroup.periods[timeOfDay] = [];
    }
    currentGroup.periods[timeOfDay].push(photo);
  });

  return groups;
};

// Smart crop detection
const getSmartCropPosition = (photo) => {
  // For portrait photos, center crop
  if (photo.orientation === 'portrait') {
    return 'center';
  }
  // For landscape, prefer bottom third (horizon line)
  return '50% 70%';
};

function PhotoTimelinePanel({
  photos = [],
  selectedPhotoId = null,
  onSelectPhoto,
  onEditNote,
  isOpen = true,
  mode = 'side', // side | overlay | sheet
  onClose,
  loading = false,
}) {
  const listRef = useRef(null);
  const rowRefs = useRef({});
  const [editingId, setEditingId] = useState(null);
  const [draftNote, setDraftNote] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // card | compact | story
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);

  const orderedPhotos = useMemo(() => {
    return [...photos].sort(sortChronologically);
  }, [photos]);

  const groups = useMemo(() => buildGroups(orderedPhotos), [orderedPhotos]);

  useEffect(() => {
    if (!isOpen || !selectedPhotoId) return;
    const node = rowRefs.current[selectedPhotoId];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedPhotoId, isOpen]);

  const deriveTitle = (photo) => {
    // Only use explicit noteTitle, not the first line of note
    if (photo?.noteTitle) return photo.noteTitle;
    // Fallback to filename if no explicit title
    return photo?.fileName || '';
  };

  const deriveSnippet = (photo, isExpanded) => {
    if (!photo?.note) return '';
    // PM requirement: show full text by default, only truncate very long notes
    if (isExpanded || photo.note.length <= 500) {
      return photo.note;
    }
    // Only truncate extremely long notes (>500 chars)
    const snippet = photo.note.slice(0, 500);
    return `${snippet}…`;
  };
  
  const shouldShowMarkdown = (note) => {
    // Detect Markdown syntax
    return note && (note.includes('**') || note.includes('*') || note.includes('- ') || note.includes('# '));
  };
  
  const handleDoubleClick = (photo, event) => {
    // Double-click on text to start editing (inline edit)
    if (event.target.closest('.text-cell') && !event.target.closest('.note-editor')) {
      startEdit(photo, event);
    }
  };

  const toggleExpand = (photoId, event) => {
    if (event) event.stopPropagation();
    setExpandedId(expandedId === photoId ? null : photoId);
  };

  const handlePhotoClick = (photo, event) => {
    // If clicking on the thumbnail, toggle expand
    if (event.target.tagName === 'IMG' || event.target.closest('.thumb-cell')) {
      toggleExpand(photo.id, event);
    } else if (onSelectPhoto) {
      onSelectPhoto(photo);
    }
  };

  const startEdit = (photo, event) => {
    if (event) event.stopPropagation();
    setEditingId(photo.id);
    setDraftNote(photo.note || '');
  };

  const cancelEdit = (event) => {
    if (event) event.stopPropagation();
    setEditingId(null);
    setDraftNote('');
  };

  const saveEdit = (photo, event) => {
    if (event) event.stopPropagation();
    if (typeof onEditNote === 'function') {
      onEditNote({
        photoId: photo.id,
        metadataId: photo.metadataId,
        note: draftNote,
        noteTitle: deriveTitle({ ...photo, note: draftNote }),
      });
    }
    setEditingId(null);
  };

  if (!isOpen && mode !== 'side') {
    return null;
  }

  return (
    <section className={`PhotoTimelinePanel mode-${mode} view-${viewMode} ${isOpen ? 'open' : 'closed'}`}>
      <header className="timeline-header">
        <div>
          <p className="eyebrow">Trip Timeline</p>
          <h3>{orderedPhotos.length ? `${orderedPhotos.length} items` : 'No items yet'}</h3>
          <p className="subtitle">Chronological • Date Taken (captured_at)</p>
        </div>
        <div className="timeline-controls">
          <div className="view-mode-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Card layout - Large photos with full notes"
            >
              🗂 Card
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
              title="Compact layout - Smaller photos, side-by-side"
            >
              ☰ Compact
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'story' ? 'active' : ''}`}
              onClick={() => setViewMode('story')}
              title="Story layout - Vertical immersive experience"
            >
              📱 Story
            </button>
          </div>
          {mode !== 'side' && (
            <button className="timeline-close" type="button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </header>

      <div className="timeline-scroll" ref={listRef}>
        {loading && <div className="timeline-empty">Loading photos…</div>}
        {!loading && orderedPhotos.length === 0 && (
          <div className="timeline-empty">
            <p>No trip photos or waypoints available yet.</p>
            <p className="muted">Uploads and GPX tracks will appear here ordered by their timestamp.</p>
          </div>
        )}

        {!loading && groups.map((group) => (
          <div key={group.id} className="timeline-group">
            <div className="timeline-day">
              <span className="day-label">{group.label}</span>
              <span className="day-date">{group.dateLabel}</span>
            </div>
            {Object.entries(group.periods).map(([period, periodPhotos]) => (
              <div key={`${group.id}-${period}`} className="timeline-period">
                <div className="timeline-period-header">
                  <span className="period-label">{getTimeOfDayLabel(period)}</span>
                  <span className="period-count">{periodPhotos.length} items</span>
                </div>
                {periodPhotos.map((item) => {
              const isPhoto = item.type === 'photo';
              const isWaypoint = item.type === 'waypoint';
              const isSelected = selectedPhotoId === item.id;
              const isEditing = editingId === item.id;
              const isExpanded = expandedId === item.id;
              const isHovered = hoveredPhotoId === item.id;
              const title = deriveTitle(item);
              const snippet = deriveSnippet(item, isExpanded);
              const hasLocation = item.lat !== null && item.lon !== null;
              const useMarkdown = shouldShowMarkdown(snippet);
              const cropPosition = getSmartCropPosition(item);

              return (
                <article
                  key={item.id}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current[item.id] = el;
                    } else {
                      delete rowRefs.current[item.id];
                    }
                  }}
                  className={`timeline-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''} ${isHovered ? 'hovered' : ''} ${isWaypoint ? 'timeline-row--waypoint' : 'timeline-row--photo'}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handlePhotoClick(item, e)}
                  onDoubleClick={(e) => handleDoubleClick(item, e)}
                  onMouseEnter={() => setHoveredPhotoId(item.id)}
                  onMouseLeave={() => setHoveredPhotoId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPhoto && onSelectPhoto(item);
                    }
                  }}
                >
                  {isSelected && <span className="accent-bar" aria-hidden="true" />}
                  
                  <div className="timeline-item-header">
                    <div className="time-cell">{formatTime(item.capturedDate)}</div>
                    {isPhoto && item.capturedSource === 'fallback' && (
                      <div className="meta-pill" title="Date Taken missing; using upload time">
                        Fallback time
                      </div>
                    )}
                    {isWaypoint && (
                      <div className="meta-pill waypoint-badge" title="GPS Waypoint">
                        📍 Waypoint
                      </div>
                    )}
                  </div>

                  <div className="timeline-content-wrapper">
                    {isPhoto && (
                      <div 
                        className={`thumb-cell ${viewMode}`}
                        onClick={(e) => toggleExpand(item.id, e)}
                        title={isExpanded ? 'Click to view smaller' : 'Click to view larger'}
                        role="button"
                        aria-label={isExpanded ? 'Collapse image' : 'Expand image to full size'}
                        style={{
                          '--crop-position': cropPosition
                        }}
                      >
                        <img 
                          src={isExpanded ? item.imageUrl : (item.thumbnailUrl || item.imageUrl)} 
                          alt={title || item.fileName}
                          loading="lazy"
                          style={{
                            objectPosition: cropPosition
                          }}
                        />
                        {isHovered && !isExpanded && (
                          <div className="photo-hover-overlay">
                            <span className="zoom-hint">🔍 Click to expand</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isWaypoint && (
                      <div className="waypoint-icon-cell">
                        <div className="waypoint-icon" role="img" aria-label="Waypoint marker">
                          📍
                        </div>
                        {item.elev !== null && (
                          <div className="waypoint-elev">{Math.round(item.elev)}m</div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-cell">
                      {isWaypoint && (
                        <h4 className="primary">
                          {item.elev !== null 
                            ? `Waypoint at ${Math.round(item.elev)}m elevation`
                            : 'Waypoint'}
                        </h4>
                      )}
                      {isPhoto && (!snippet || (item.noteTitle && item.noteTitle !== snippet)) && (
                        <h4 className="primary">{title || item.fileName}</h4>
                      )}
                      {!isEditing && snippet && (
                        <div className="secondary">
                          {useMarkdown ? (
                            <ReactMarkdown>{snippet}</ReactMarkdown>
                          ) : (
                            snippet
                          )}
                        </div>
                      )}
                      {!isEditing && !snippet && isPhoto && (
                        <div className="secondary">
                          <span className="muted">Add a note about this moment…</span>
                        </div>
                      )}
                      {hasLocation && (
                        <button 
                          className="view-on-map-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPhoto && onSelectPhoto(item);
                          }}
                          title={`Center map on this ${isWaypoint ? 'waypoint' : 'photo'} location`}
                          aria-label={`View ${title || item.fileName} on map`}
                        >
                          📍 View on map
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && isPhoto && (
                    <div className="note-editor" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="Add a note about this moment… Share the story behind the photo."
                        autoFocus
                      />
                      <div className="note-actions">
                        <button type="button" onClick={(e) => saveEdit(item, e)}>
                          Save Note
                        </button>
                        <button type="button" className="ghost" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="timeline-item-footer">
                    <div className="actions-cell">
                      {!isEditing && isPhoto && (
                        <button 
                          type="button" 
                          className="ghost small" 
                          onClick={(e) => startEdit(item, e)}
                          aria-label={`Edit note for ${title || item.fileName}`}
                        >
                          ✏️ Edit note
                        </button>
                      )}
                      {/* Only show Read more for very long notes (>500 chars) */}
                      {(item.note && item.note.length > 500) && !isExpanded && (
                        <button
                          type="button"
                          className="expand-toggle"
                          onClick={(e) => toggleExpand(item.id, e)}
                          aria-label="Read full note"
                        >
                          Read more →
                        </button>
                      )}
                      {isExpanded && (
                        <button
                          type="button"
                          className="expand-toggle"
                          onClick={(e) => toggleExpand(item.id, e)}
                          aria-label="Show less"
                        >
                          ← Show less
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default PhotoTimelinePanel;
