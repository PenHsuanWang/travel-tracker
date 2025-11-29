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
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDayPeriod = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const hour = date.getHours();
  if (hour < 6) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 18) return '下午';
  return '晚上';
};

const hasMarkdown = (note) => {
  if (!note) return false;
  const markdownPattern = /(\*\*|__|`|#|\[.+?\]\(.+?\)|-\s)/g;
  return markdownPattern.test(note);
};

const getItemMeta = (item) => {
  if (item.type === 'waypoint') {
    return {
      icon: '📍',
      className: 'timeline-entry--waypoint',
      label: 'Waypoint',
    };
  }
  return {
    icon: '📷',
    className: 'timeline-entry--photo',
    label: 'Photo',
  };
};

const getSubtitle = (item) => {
  if (item.type === 'waypoint') {
    if (Number.isFinite(item.elev)) {
      return `${Math.round(item.elev)}m elevation`;
    }
    return 'Waypoint imported from GPX track';
  }
  return formatDate(item.capturedDate);
};

const getTitle = (item) => {
  if (item?.noteTitle) return item.noteTitle;
  if (item?.note && item.type === 'waypoint') return item.note.split('\n')[0];
  if (item?.fileName) return item.fileName;
  return item.type === 'waypoint' ? 'Waypoint' : 'Untitled photo';
};

function PhotoTimelinePanel({
  photos = [],
  selectedPhotoId = null,
  onSelectPhoto,
  onEditNote,
  isOpen = true,
  mode = 'side',
  onClose,
  loading = false,
}) {
  const listRef = useRef(null);
  const rowRefs = useRef({});
  const [editingId, setEditingId] = useState(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [localSelectionId, setLocalSelectionId] = useState(null);

  const orderedItems = useMemo(() => [...photos].sort(sortChronologically), [photos]);
  const activeSelectionId = selectedPhotoId || localSelectionId;
  const canEditTimelineItems = typeof onEditNote === 'function';

  useEffect(() => {
    if (!isOpen || !activeSelectionId) return;
    const node = rowRefs.current[activeSelectionId];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSelectionId, isOpen]);

  useEffect(() => {
    if (selectedPhotoId) {
      setLocalSelectionId(null);
    }
  }, [selectedPhotoId]);

  const closeEditor = () => {
    setEditingId(null);
    setDraftNote('');
    setDraftTitle('');
  };

  const startEdit = (item, event) => {
    if (event) event.stopPropagation();
    if (!canEditTimelineItems) return;
    setEditingId(item.id);
    setDraftNote(item.note || '');
    setDraftTitle(item.noteTitle || '');
  };

  const saveEdit = (item, event) => {
    if (event) event.stopPropagation();
    if (typeof onEditNote === 'function') {
      onEditNote({
        itemType: item.type,
        photoId: item.type === 'photo' ? item.id : null,
        waypointId: item.type === 'waypoint' ? item.id : null,
        metadataId: item.metadataId,
        note: draftNote,
        noteTitle: draftTitle || null,
      });
    }
    closeEditor();
  };

  const handleWaypointFocus = (item) => {
    setLocalSelectionId(item.id);
    if (typeof window === 'undefined') return;
    if (item.lat === null || item.lon === null) return;
    window.dispatchEvent(
      new CustomEvent('centerMapOnLocation', {
        detail: {
          lat: item.lat,
          lng: item.lon,
          source: 'timeline-waypoint',
        },
      })
    );
  };

  const handleActivate = (item) => {
    if (item.type === 'photo') {
      onSelectPhoto && onSelectPhoto(item);
      return;
    }
    handleWaypointFocus(item);
  };

  const handleCardKeyDown = (item, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate(item);
    }
  };

  if (!isOpen && mode !== 'side') {
    return null;
  }

  return (
    <section className={`PhotoTimelinePanel mode-${mode} ${isOpen ? 'open' : 'closed'}`}>
      <header className="timeline-header">
        <div>
          <p className="eyebrow">Trip Timeline</p>
          <h3>{orderedItems.length ? `${orderedItems.length} recorded moments` : 'No items yet'}</h3>
          <p className="subtitle">Photos and GPX waypoints are merged chronologically.</p>
        </div>
        {mode !== 'side' && (
          <button className="timeline-close" type="button" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      <div className="timeline-scroll" ref={listRef}>
        {loading && <div className="timeline-empty">Loading timeline…</div>}
        {!loading && orderedItems.length === 0 && (
          <div className="timeline-empty">
            <p>No trip photos or waypoints available yet.</p>
            <p className="muted">Uploads and GPX tracks will appear here ordered by their timestamp.</p>
          </div>
        )}

        {!loading && orderedItems.map((item, index) => {
          const meta = getItemMeta(item);
          const subtitle = getSubtitle(item);
          const title = getTitle(item);
          const note = item.note || '';
          const rowKey = item.id || `${item.type}-${index}`;
          const isSelected = activeSelectionId === item.id;
          const isEditing = editingId === item.id;
          const canEdit = canEditTimelineItems;
          const placeholderText = item.type === 'photo' ? 'Add a note about this moment…' : 'Add notes for this waypoint…';
          const showNoteBody = Boolean(note);
          const hasMediaAsset = item.type === 'photo' && (item.thumbnailUrl || item.imageUrl);
          const timeLabel = formatTime(item.capturedDate);
          const timePeriod = formatDayPeriod(item.capturedDate);

          return (
            <div
              key={rowKey}
              className={`timeline-entry ${meta.className} ${isSelected ? 'selected' : ''}`}
              ref={(el) => {
                if (el) {
                  rowRefs.current[item.id || rowKey] = el;
                } else {
                  delete rowRefs.current[item.id || rowKey];
                }
              }}
            >
              <div className="timeline-track" aria-hidden="true" />
              <div className="timeline-header-row">
                <div className="timeline-node" aria-label={meta.label} role="img">
                  {meta.icon}
                </div>
                <time className="timeline-time" dateTime={item.capturedAt || undefined}>
                  {timePeriod && <span className="timeline-time-period">{timePeriod}</span>}
                  <span className="timeline-time-clock">{timeLabel}</span>
                </time>
              </div>
              <div className="timeline-card-wrapper">
                <div
                  className="timeline-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleActivate(item)}
                  onKeyDown={(event) => handleCardKeyDown(item, event)}
                >
                  <div className="timeline-card-header">
                    <div className="timeline-card-text">
                      <p className="timeline-card-title">{title}</p>
                      <p className="timeline-card-subtitle">{subtitle}</p>
                    </div>
                    {canEdit && !isEditing && (
                      <button
                        type="button"
                        className="timeline-edit-btn"
                        onClick={(event) => startEdit(item, event)}
                        aria-label={`Edit note for ${title}`}
                      >
                        ✏️
                      </button>
                    )}
                  </div>

                  {hasMediaAsset && !isEditing && (
                    <div className="timeline-media" role="presentation">
                      <img
                        src={item.thumbnailUrl || item.imageUrl}
                        alt={title}
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="timeline-card-body">
                    {isEditing ? (
                      <div className="timeline-edit-form" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          placeholder="Title"
                        />
                        <textarea
                          value={draftNote}
                          onChange={(event) => setDraftNote(event.target.value)}
                          placeholder="Write the story behind this moment…"
                          rows={4}
                        />
                        <div className="timeline-card-actions">
                          <button type="button" className="ghost" onClick={closeEditor}>
                            Cancel
                          </button>
                          <button type="button" onClick={(event) => saveEdit(item, event)}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : showNoteBody ? (
                      <div className="timeline-note">
                        {hasMarkdown(note) ? <ReactMarkdown>{note}</ReactMarkdown> : <p>{note}</p>}
                      </div>
                    ) : (
                      <p className="timeline-note placeholder">{placeholderText}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PhotoTimelinePanel;
