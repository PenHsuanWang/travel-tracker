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
    if (photo?.noteTitle) return photo.noteTitle;
    if (photo?.note) {
      const firstLine = String(photo.note).split('\n')[0].trim();
      if (firstLine) return firstLine;
    }
    return photo?.fileName || '';
  };

  const deriveSnippet = (photo) => {
    if (!photo?.note) return '';
    const snippet = photo.note.slice(0, 160);
    return photo.note.length > 160 ? `${snippet}…` : snippet;
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
              const title = deriveTitle(photo);
              const snippet = deriveSnippet(photo);

              return (
                <div
                  key={photo.id}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current[photo.id] = el;
                    } else {
                      delete rowRefs.current[photo.id];
                    }
                  }}
                  className={`timeline-row ${isSelected ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPhoto && onSelectPhoto(photo)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectPhoto && onSelectPhoto(photo);
                    }
                  }}
                >
                  <div className="time-cell">{formatTime(photo.capturedDate)}</div>
                  <div className="thumb-cell">
                    <img src={photo.thumbnailUrl || photo.imageUrl} alt={photo.fileName} />
                  </div>
                  <div className="text-cell">
                    <div className="primary">{title || photo.fileName}</div>
                    {isEditing ? (
                      <div className="note-editor" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={draftNote}
                          onChange={(e) => setDraftNote(e.target.value)}
                          placeholder="Add a note about this moment…"
                          rows={3}
                        />
                        <div className="note-actions">
                          <button type="button" onClick={(e) => saveEdit(photo, e)}>
                            Save
                          </button>
                          <button type="button" className="ghost" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="secondary">
                        {snippet || <span className="muted">Add a note</span>}
                      </div>
                    )}
                    {photo.capturedSource === 'fallback' && (
                      <div className="meta-pill" title="Date Taken missing; using upload time">
                        Fallback time
                      </div>
                    )}
                  </div>
                  <div className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="ghost small" onClick={(e) => startEdit(photo, e)}>
                      {isEditing ? 'Editing' : 'Edit note'}
                    </button>
                  </div>
                  {isSelected && <span className="accent-bar" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export default PhotoTimelinePanel;
