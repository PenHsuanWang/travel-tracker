// client/src/components/common/PhotoViewerOverlay.js
import React, { useEffect } from 'react';
import '../../styles/PhotoViewerOverlay.css';

const formatTime = (date) => {
  if (!date) return 'Unknown time';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function PhotoViewerOverlay({
  isOpen,
  photo,
  index = 0,
  total = 0,
  onClose,
  onPrev,
  onNext,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
      if (event.key === 'ArrowLeft') {
        onPrev?.();
      }
      if (event.key === 'ArrowRight') {
        onNext?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, onPrev, onNext]);

  if (!isOpen || !photo) {
    return null;
  }

  const timeLabel = formatTime(photo.capturedDate || photo.capturedAt);

  return (
    <div className="PhotoViewerOverlay" onClick={onClose}>
      <div className="viewer-shell" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" type="button" onClick={onClose} aria-label="Close viewer">
          ×
        </button>

        <div className="viewer-index">
          {index + 1} / {total}
        </div>

        <div className="viewer-image">
          <img src={photo.imageUrl} alt={photo.fileName || 'Trip photo'} />
        </div>

        <div className="viewer-nav">
          <button type="button" onClick={onPrev} disabled={index <= 0}>
            Previous
          </button>
          <button type="button" onClick={onNext} disabled={index >= total - 1}>
            Next
          </button>
        </div>

        <div className="viewer-meta">
          <div className="viewer-time">{timeLabel}</div>
          {photo.fileName && <div className="viewer-title">{photo.fileName}</div>}
          {photo.caption && <div className="viewer-caption">{photo.caption}</div>}
        </div>
      </div>
    </div>
  );
}

export default PhotoViewerOverlay;
