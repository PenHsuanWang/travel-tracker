// client/src/components/map/ImageLayer.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getGeotaggedImages, updatePhotoNote } from '../../services/api';
import '../../styles/ImageLayer.css';

const FALLBACK_THUMBNAIL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160"%3E%3Crect fill="%23f1f5f9" width="160" height="160" rx="12"/%3E%3Cpath fill="%23cbd5f5" d="M30 110l26-32 26 20 30-38 28 50z"/%3E%3Ccircle cx="52" cy="54" r="14" fill="%23dbeafe"/%3E%3C/svg%3E';

const hasValidCoords = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);

export async function fetchGeotaggedImagesForTrip(fetcher = getGeotaggedImages, tripId = null) {
  const images = await fetcher(undefined, undefined, undefined, undefined, 'images', tripId);
  return Array.isArray(images) ? images : [];
}

/**
 * ImageLayer Component
 * 
 * Renders markers for geotagged images on the map using react-leaflet.
 * This component works with the Leaflet map from react-leaflet's useMap hook.
 */
function ImageLayer({ onImageSelected = null, tripId = null, readOnly = false, photos = [], onPhotoUpdate = null }) {
  const map = useMap();
  const [markers, setMarkers] = useState({});
  const markersRef = useRef({});

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const handleMarkerSelected = useCallback((image, selectionOptions = {}) => {
    if (!image) {
      return;
    }

    const detail = {
      object_key: image.object_key,
      original_filename: image.original_filename,
      lat: Number(image.lat),
      lon: Number(image.lon),
      metadata_id: image.metadata_id || null,
      source: selectionOptions.interactionSource || selectionOptions.source || 'map-marker',
    };

    window.dispatchEvent(new CustomEvent('mapImageSelected', { detail }));

    if (typeof onImageSelected === 'function') {
      onImageSelected(image, selectionOptions);
    }
  }, [onImageSelected]);

  const registerMarkerEvents = useCallback((marker, image) => {
    // We rely on Leaflet's default behavior to open the popup on click.
    // We do NOT want to trigger handleMarkerSelected (which opens the lightbox) immediately.
    // So we don't attach the handler to 'click' or 'popupopen'.
    const handler = () => {};
    return handler;
  }, []);

  const detachMarkerEntry = useCallback((entry) => {
    if (!entry) return;
    entry.marker.off('click', entry.handler);
    entry.marker.off('popupopen', entry.handler);
    try {
      entry.marker.remove();
    } catch (err) {
      console.warn('[ImageLayer] Failed to remove marker cleanly', err);
    }
  }, []);

  const clearAllMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach(detachMarkerEntry);
    markersRef.current = {};
    setMarkers({});
  }, [detachMarkerEntry]);

  /**
   * Load geotagged images and create markers
   */
  /**
   * Load geotagged images and create markers
   */
  /**
   * Sync markers with photos prop
   */
  useEffect(() => {
    if (!map) return;

    const currentMarkers = { ...markersRef.current };
    const newMarkers = {};
    const processedKeys = new Set();

    // 1. Update or Create markers
    (photos || []).forEach((photo) => {
        const key = photo.objectKey || photo.id;
        if (!key) return;
        
        processedKeys.add(key);

        // Normalize photo data for ImageLayer
        const lat = Number(photo.lat);
        const lon = Number(photo.lon);
        if (!hasValidCoords(lat, lon)) {
          return;
        }

        const image = {
          object_key: key,
          original_filename: photo.fileName,
          lat,
          lon,
          thumb_url: photo.thumbnailUrl,
          note: photo.note,
          metadata_id: photo.metadataId
        };

        if (currentMarkers[key]) {
            // Update existing marker
            const entry = currentMarkers[key];
            entry.image = image; // Update data reference
            newMarkers[key] = entry;

            // Update Popup DOM if open
            if (entry.marker.isPopupOpen()) {
                 const popupContent = entry.marker.getPopup().getContent();
                 if (popupContent instanceof HTMLElement) {
                     const textarea = popupContent.querySelector('textarea');
                     const noteDisplay = popupContent.querySelector('.image-popup-note-display');
                     
                     // Only update textarea if it's NOT focused (to avoid overwriting user typing)
                     if (textarea && document.activeElement !== textarea) {
                         textarea.value = image.note || '';
                     }
                     
                     // Always update display div
                     if (noteDisplay) {
                         const displayText = image.note || (readOnly ? 'No note added.' : 'Add a note about this moment…');
                         if (noteDisplay.textContent !== displayText) {
                             noteDisplay.textContent = displayText;
                             if (!image.note) noteDisplay.classList.add('muted');
                             else noteDisplay.classList.remove('muted');
                         }
                     }
                 }
            }
        } else {
            // Create new marker
            try {
                const displayName = getDisplayName(image.original_filename);
                const marker = L.marker([image.lat, image.lon], {
                    title: displayName,
                    icon: createPhotoMarkerIcon(image),
                    riseOnHover: true,
                    zIndexOffset: 150,
                });

                marker.bindTooltip(displayName, {
                    direction: 'top',
                    offset: [0, -38],
                    opacity: 0.95,
                    className: 'photo-tooltip',
                });

                // Create popup content
                const popupContent = createPopupContent(image, handleMarkerSelected, readOnly, onPhotoUpdate);
                marker.bindPopup(popupContent, { maxWidth: 300 });
                
                const handler = registerMarkerEvents(marker, image);
                marker.addTo(map);

                newMarkers[key] = {
                    marker,
                    image,
                    handler,
                };
            } catch (err) {
                console.error('[ImageLayer] Error creating marker for', key, err);
            }
        }
    });

    // 2. Remove old markers
    Object.keys(currentMarkers).forEach((key) => {
        if (!processedKeys.has(key)) {
            detachMarkerEntry(currentMarkers[key]);
        }
    });

    setMarkers(newMarkers);
    markersRef.current = newMarkers;

  }, [map, photos, readOnly, onPhotoUpdate, handleMarkerSelected, registerMarkerEvents, detachMarkerEntry]);

  /**
   * Center and open popup when sidebar requests
   */
  useEffect(() => {
    if (!map) return undefined;

    const handleCenterMap = (event) => {
      const detail = event.detail || {};
      const objectKey = detail.object_key;
      const entry = objectKey ? markersRef.current[objectKey] : null;

      const latValue = detail.lat ?? detail.latitude;
      const lngValue = detail.lng ?? detail.lon ?? detail.longitude;
      const latNum = Number(latValue);
      const lngNum = Number(lngValue);
      const hasCoords = hasValidCoords(latNum, lngNum);
      const fallbackLatLng = hasCoords ? L.latLng(latNum, lngNum) : null;

      const targetLatLng = entry ? entry.marker.getLatLng() : fallbackLatLng;
      if (!targetLatLng) {
        return;
      }

      const targetZoom = Math.max(map.getZoom(), 14);
      map.flyTo(targetLatLng, targetZoom, { animate: true });

      if (entry) {
        entry.marker.openPopup();
        const selectionOptions = {
          preventViewer: Boolean(detail.preventViewer),
          interactionSource: detail.source || 'programmatic-center',
        };
        handleMarkerSelected(entry.image, selectionOptions);
      }
    };

    window.addEventListener('centerMapOnLocation', handleCenterMap);
    return () => window.removeEventListener('centerMapOnLocation', handleCenterMap);
  }, [map, handleMarkerSelected]);

  // Component doesn't render anything itself, just manages map markers
  return null;
}

/**
 * Extract display name (remove UUID prefix if present)
 * Handles formats like: UUID_IMG_0651.jpg or uuid_filename.jpg or 12345678901234567890123456789012_file.jpg
 */
function getDisplayName(filename) {
  // Pattern 1: Standard UUID format with dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_name
  const uuidDashPattern = filename.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_(.+)$/i);
  if (uuidDashPattern && uuidDashPattern[1]) {
    return uuidDashPattern[1];
  }

  // Pattern 2: 32-character UUID without dashes: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_name
  const uuidNoDashPattern = filename.match(/^[a-f0-9]{32}_(.+)$/i);
  if (uuidNoDashPattern && uuidNoDashPattern[1]) {
    return uuidNoDashPattern[1];
  }

  // Pattern 3: Shorter alphanumeric ID: xxxxxxxx_name (at least 8 chars, then underscore)
  const alphaPattern = filename.match(/^[a-z0-9]{8,}_(.+)$/i);
  if (alphaPattern && alphaPattern[1]) {
    return alphaPattern[1];
  }

  // Pattern 4: No UUID/ID, return as-is
  return filename;
}

/**
 * Create HTML content for marker popup
 */
function createPopupContent(image, onMarkerSelected, readOnly, onPhotoUpdate) {
  const displayName = getDisplayName(image.original_filename);
  const truncatedName = displayName.length > 30
    ? `${displayName.substring(0, 27)}...`
    : displayName;
  const resolvedThumbUrl = resolveThumbUrl(image.thumb_url);

  const container = document.createElement('div');
  container.className = 'image-popup';

  const thumbnailWrapper = document.createElement('div');
  thumbnailWrapper.className = 'image-popup-thumbnail';

  const imageEl = document.createElement('img');
  imageEl.alt = displayName;
  imageEl.src = resolvedThumbUrl || FALLBACK_THUMBNAIL;
  imageEl.loading = 'lazy';
  imageEl.decoding = 'async';
  imageEl.style.display = 'none';
  imageEl.onload = () => { imageEl.style.display = 'block'; };
  imageEl.onerror = () => {
    if (imageEl.src !== FALLBACK_THUMBNAIL) imageEl.src = FALLBACK_THUMBNAIL;
    imageEl.style.display = 'block';
  };
  thumbnailWrapper.appendChild(imageEl);
  container.appendChild(thumbnailWrapper);

  thumbnailWrapper.addEventListener('dblclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('timelineScrollToItem', { detail: { itemId: image.object_key } }));
    }
    if (typeof onMarkerSelected === 'function') {
      onMarkerSelected(image, {
        forceViewer: true,
        interactionSource: 'popup-thumbnail-dblclick',
      });
    }
  });

  const nameEl = document.createElement('div');
  nameEl.className = 'image-popup-name';
  nameEl.title = displayName;
  nameEl.textContent = truncatedName;
  container.appendChild(nameEl);

  const coordsEl = document.createElement('div');
  coordsEl.className = 'image-popup-coords';
  const coordsText = document.createElement('small');
  coordsText.textContent = `${image.lat.toFixed(4)}°, ${image.lon.toFixed(4)}°`;
  coordsEl.appendChild(coordsText);
  container.appendChild(coordsEl);

  const noteContainer = document.createElement('div');
  noteContainer.className = 'image-popup-note';

  const noteLabel = document.createElement('div');
  noteLabel.className = 'image-popup-note-label';
  noteLabel.textContent = 'Note / Story';
  noteContainer.appendChild(noteLabel);

  const noteDisplay = document.createElement('div');
  noteDisplay.className = 'image-popup-note-display';
  const existingNote = image.note || '';
  noteDisplay.textContent = existingNote || (readOnly ? 'No note added.' : 'Add a note about this moment…');
  if (!existingNote) noteDisplay.classList.add('muted');
  noteContainer.appendChild(noteDisplay);

  if (!readOnly) {
    const noteEditor = document.createElement('textarea');
    noteEditor.className = 'image-popup-note-editor';
    noteEditor.value = existingNote;
    noteEditor.style.display = 'none';
    noteContainer.appendChild(noteEditor);

    const toggleEditor = (show) => {
      noteEditor.style.display = show ? 'block' : 'none';
      noteDisplay.style.display = show ? 'none' : 'block';
      if (show) {
        noteEditor.focus();
        noteEditor.selectionStart = noteEditor.value.length;
      }
    };

    noteDisplay.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleEditor(true);
    });

    // Real-time sync on input
    noteEditor.addEventListener('input', (e) => {
        const newNote = e.target.value;
        if (onPhotoUpdate) {
            onPhotoUpdate(image.object_key, newNote, false); // false = do not save to backend yet
        }
    });

    // Save on blur
    noteEditor.addEventListener('blur', () => {
      const newNote = noteEditor.value;
      // Optimistic update for display
      noteDisplay.textContent = newNote || 'Add a note about this moment…';
      if (newNote) noteDisplay.classList.remove('muted');
      else noteDisplay.classList.add('muted');
      
      toggleEditor(false);

      if (onPhotoUpdate) {
          onPhotoUpdate(image.object_key, newNote, true); // true = save to backend
      }
    });

    noteEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        noteEditor.blur(); // Triggers save via blur
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        noteEditor.value = image.note || ''; // Revert to last known state
        toggleEditor(false);
      }
    });

    noteEditor.addEventListener('click', (e) => e.stopPropagation());
  }

  container.appendChild(noteContainer);

  // Removed "View Details" button and click handlers to prevent lightbox from opening
  // per user request "remove all the lightbox from clicking photo marker"

  return container;
}

export default ImageLayer;

function resolveThumbUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseCandidate =
    (() => {
      const raw = process.env.REACT_APP_API_BASE_URL;
      if (raw) {
        try {
          // Normalize to origin to avoid double "/api" when URLs are already absolute paths.
          return new URL(raw).origin;
        } catch (err) {
          console.warn('[ImageLayer] Invalid REACT_APP_API_BASE_URL, falling back to window origin', err);
        }
      }
      return typeof window !== 'undefined' ? window.location.origin : '';
    })();

  if (!baseCandidate) {
    return url;
  }

  try {
    return new URL(url, baseCandidate).toString();
  } catch (err) {
    console.warn('[ImageLayer] Failed to resolve thumbnail URL', err);
    return url;
  }
}

function createPhotoMarkerIcon(image) {
  const resolvedThumbUrl = resolveThumbUrl(image.thumb_url) || FALLBACK_THUMBNAIL;
  const safeUrl = encodeURI(resolvedThumbUrl);

  return L.divIcon({
    className: 'photo-marker',
    html: `
      <div class="photo-pin">
        <div class="photo-pin__thumb" style="background-image:url('${safeUrl}')"></div>
        <div class="photo-pin__status">
          <span class="photo-pin__status-dot"></span>
        </div>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 46],
    popupAnchor: [0, -44],
    tooltipAnchor: [0, -42],
  });
}
