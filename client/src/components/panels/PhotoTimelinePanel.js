// client/src/components/panels/PhotoTimelinePanel.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const buildGroups = (photos) => {
  const groups = [];
  let dayCounter = 0;
  let lastDayKey = null;

  photos.forEach((photo) => {
    const dayKey = photo.capturedDate ? photo.capturedDate.toISOString().slice(0, 10) : 'unknown';
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
        photos: [],
        isUnknown,
      });
    }
    groups[groups.length - 1].photos.push(photo);
  });

  return groups;
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
    <section className={`PhotoTimelinePanel mode-${mode} ${isOpen ? 'open' : 'closed'}`}>
      <header className="timeline-header">
        <div>
          <p className="eyebrow">Trip Photo Timeline</p>
          <h3>{orderedPhotos.length ? `${orderedPhotos.length} photos` : 'No photos yet'}</h3>
          <p className="subtitle">Chronological • Date Taken (captured_at)</p>
        </div>
        {mode !== 'side' && (
          <button className="timeline-close" type="button" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      <div className="timeline-scroll" ref={listRef}>
        {loading && <div className="timeline-empty">Loading photos…</div>}
        {!loading && orderedPhotos.length === 0 && (
          <div className="timeline-empty">
            <p>No trip photos available yet.</p>
            <p className="muted">Uploads will appear here ordered by their Date Taken.</p>
          </div>
        )}

        {!loading && groups.map((group) => (
          <div key={group.id} className="timeline-group">
            <div className="timeline-day">
              <span className="day-label">{group.label}</span>
              <span className="day-date">{group.dateLabel}</span>
            </div>
            {group.photos.map((photo) => {
              const isSelected = selectedPhotoId === photo.id;
              const isEditing = editingId === photo.id;
              const isExpanded = expandedId === photo.id;
              const title = deriveTitle(photo);
              const snippet = deriveSnippet(photo, isExpanded);
              const hasLocation = photo.lat !== null && photo.lon !== null;

              return (
                <article
                  key={photo.id}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current[photo.id] = el;
                    } else {
                      delete rowRefs.current[photo.id];
                    }
                  }}
                  className={`timeline-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handlePhotoClick(photo, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPhoto && onSelectPhoto(photo);
                    }
                  }}
                >
                  {isSelected && <span className="accent-bar" aria-hidden="true" />}
                  
                  <div className="timeline-item-header">
                    <div className="time-cell">{formatTime(photo.capturedDate)}</div>
                    {photo.capturedSource === 'fallback' && (
                      <div className="meta-pill" title="Date Taken missing; using upload time">
                        Fallback time
                      </div>
                    )}
                  </div>

                  <div className="timeline-content-wrapper">
                    <div 
                      className="thumb-cell"
                      onClick={(e) => toggleExpand(photo.id, e)}
                      title={isExpanded ? 'Click to view smaller' : 'Click to view larger'}
                      role="button"
                      aria-label={isExpanded ? 'Collapse image' : 'Expand image to full size'}
                    >
                      <img 
                        src={isExpanded ? photo.imageUrl : (photo.thumbnailUrl || photo.imageUrl)} 
                        alt={title || photo.fileName}
                        loading="lazy"
                      />
                    </div>
                    
                    <div className="text-cell">
                      {/* Only show title heading if there's no note, or if there's an explicit noteTitle different from the note */}
                      {(!snippet || (photo.noteTitle && photo.noteTitle !== snippet)) && (
                        <h4 className="primary">{title || photo.fileName}</h4>
                      )}
                      {!isEditing && snippet && (
                        <div className="secondary">
                          {snippet}
                        </div>
                      )}
                      {!isEditing && !snippet && (
                        <div className="secondary">
                          <span className="muted">Add a note about this moment…</span>
                        </div>
                      )}
                      {hasLocation && (
                        <button 
                          className="view-on-map-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPhoto && onSelectPhoto(photo);
                          }}
                          title="Center map on this photo location"
                          aria-label={`View ${title || photo.fileName} on map`}
                        >
                          📍 View on map
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="note-editor" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="Add a note about this moment… Share the story behind the photo."
                        autoFocus
                      />
                      <div className="note-actions">
                        <button type="button" onClick={(e) => saveEdit(photo, e)}>
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
                      {!isEditing && (
                        <button 
                          type="button" 
                          className="ghost small" 
                          onClick={(e) => startEdit(photo, e)}
                          aria-label={`Edit note for ${title || photo.fileName}`}
                        >
                          ✏️ Edit note
                        </button>
                      )}
                      {/* Only show Read more for very long notes (>500 chars) */}
                      {(photo.note && photo.note.length > 500) && !isExpanded && (
                        <button
                          type="button"
                          className="expand-toggle"
                          onClick={(e) => toggleExpand(photo.id, e)}
                          aria-label="Read full note"
                        >
                          Read more →
                        </button>
                      )}
                      {isExpanded && (
                        <button
                          type="button"
                          className="expand-toggle"
                          onClick={(e) => toggleExpand(photo.id, e)}
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
    </section>
  );
}

export default PhotoTimelinePanel;
