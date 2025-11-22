// client/src/components/map/ImageLayer.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getGeotaggedImages, updatePhotoNote } from '../../services/api';
import '../../styles/ImageLayer.css';

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
function ImageLayer({ onImageSelected = null, tripId = null }) {
  const map = useMap();
  const [markers, setMarkers] = useState({});
  const markersRef = useRef({});


  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const handleMarkerSelected = useCallback((image) => {
    if (!image) {
      return;
    }

    const detail = {
      object_key: image.object_key,
      original_filename: image.original_filename,
      lat: Number(image.lat),
      lon: Number(image.lon),
      metadata_id: image.metadata_id || null,
    };

    window.dispatchEvent(new CustomEvent('mapImageSelected', { detail }));

    if (typeof onImageSelected === 'function') {
      onImageSelected(image);
    }
  }, [onImageSelected]);

  const registerMarkerEvents = useCallback((marker, image) => {
    const handler = () => handleMarkerSelected(image);
    marker.on('click', handler);
    marker.on('popupopen', handler);
    return handler;
  }, [handleMarkerSelected]);

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
  const loadGeotaggedImages = useCallback(async () => {
    if (!map) return;

    try {
      const tripContextLog = tripId ? ` for trip ${tripId}` : '';
      console.log(`[ImageLayer] Loading geotagged images${tripContextLog}...`);
      clearAllMarkers();
      const images = await fetchGeotaggedImagesForTrip(getGeotaggedImages, tripId);
      console.log('[ImageLayer] Loaded', images?.length || 0, 'geotagged images for trip context');

      const newMarkers = {};

      (images || []).forEach((image) => {
        try {
          // Validate GPS coordinates
          if (!Number.isFinite(Number(image.lat)) || !Number.isFinite(Number(image.lon))) {
            console.warn('[ImageLayer] Skipping image with invalid coordinates:', image.object_key);
            return;
          }

          const lat = Number(image.lat);
          const lon = Number(image.lon);

          // Create marker with display name (no UUID)
          const displayName = getDisplayName(image.original_filename);
          const marker = L.marker([lat, lon], {
            title: displayName,
          });

          // Create popup content with thumbnail
          const popupContent = createPopupContent(image, handleMarkerSelected);
          marker.bindPopup(popupContent, { maxWidth: 300 });
          const handler = registerMarkerEvents(marker, image);

          // Add to map
          marker.addTo(map);

          // Store marker by object_key for later removal/updates
          newMarkers[image.object_key] = {
            marker,
            image,
            handler,
          };

          console.log('[ImageLayer] Created marker for:', image.original_filename, `(${lat}, ${lon})`);
        } catch (err) {
          console.error('[ImageLayer] Error creating marker for', image.object_key, ':', err);
        }
      });

      setMarkers(newMarkers);
      markersRef.current = newMarkers;
    } catch (err) {
      console.error('[ImageLayer] Error loading geotagged images:', err);
    }
  }, [map, tripId, clearAllMarkers, handleMarkerSelected, registerMarkerEvents]);

  /**
   * Initial load when map is ready
   */
  useEffect(() => {
    if (map) {
      loadGeotaggedImages();
    }
  }, [map, loadGeotaggedImages]);

  /**
   * Listen for image upload events with GPS data
   */
  useEffect(() => {
    const handleImageUploadedWithGPS = (event) => {
      console.log('[ImageLayer] Image uploaded with GPS event received', event.detail);
      const { gps, object_key, original_filename, thumb_url, metadata_id } = event.detail;

      if (!map) return;

      if (!gps || !Number.isFinite(Number(gps.latitude)) || !Number.isFinite(Number(gps.longitude))) {
        console.log('[ImageLayer] Uploaded image has no GPS, skipping marker');
        return;
      }

      const lat = Number(gps.latitude);
      const lon = Number(gps.longitude);

      try {
        // Create marker with display name (no UUID)
        const displayName = getDisplayName(original_filename);
        const marker = L.marker([lat, lon], {
          title: displayName,
        });

        const image = {
          object_key,
          original_filename,
          lat,
          lon,
          thumb_url,
          metadata_id,
        };

        const popupContent = createPopupContent(image, handleMarkerSelected);
        marker.bindPopup(popupContent, { maxWidth: 300 });
        const handler = registerMarkerEvents(marker, image);
        marker.addTo(map);

        setMarkers((prev) => {
          const updated = {
            ...prev,
            [object_key]: { marker, image, handler },
          };
          markersRef.current = updated;
          return updated;
        });

        console.log('[ImageLayer] Added marker for newly uploaded image:', original_filename);
      } catch (err) {
        console.error('[ImageLayer] Error adding marker for uploaded image:', err);
      }
    };

    window.addEventListener('imageUploadedWithGPS', handleImageUploadedWithGPS);
    return () => window.removeEventListener('imageUploadedWithGPS', handleImageUploadedWithGPS);
  }, [map, onImageSelected, registerMarkerEvents, handleMarkerSelected]);

  /**
   * Listen for image delete events
   */
  useEffect(() => {
    const handleImageDeleted = (event) => {
      console.log('[ImageLayer] Image deleted event received');
      const { object_key } = event.detail;

      if (!map) return;
      const entry = markersRef.current[object_key];
      if (!entry) return;

      try {
        detachMarkerEntry(entry);
        setMarkers((prev) => {
          const updated = { ...prev };
          delete updated[object_key];
          markersRef.current = updated;
          return updated;
        });
        console.log('[ImageLayer] Removed marker for deleted image:', object_key);
      } catch (err) {
        console.error('[ImageLayer] Error removing marker:', err);
      }
    };

    window.addEventListener('imageDeleted', handleImageDeleted);
    return () => window.removeEventListener('imageDeleted', handleImageDeleted);
  }, [map, detachMarkerEntry]);

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
      const hasCoords = Number.isFinite(Number(latValue)) && Number.isFinite(Number(lngValue));
      const fallbackLatLng = hasCoords ? L.latLng(Number(latValue), Number(lngValue)) : null;

      const targetLatLng = entry ? entry.marker.getLatLng() : fallbackLatLng;
      if (!targetLatLng) {
        console.warn('[ImageLayer] Unable to center map — missing coordinates for', objectKey);
        return;
      }

      const targetZoom = Math.max(map.getZoom(), 14);
      map.flyTo(targetLatLng, targetZoom, { animate: true });

      if (entry) {
        entry.marker.openPopup();
        handleMarkerSelected(entry.image);
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
function createPopupContent(image, onMarkerSelected) {
  const displayName = getDisplayName(image.original_filename);
  const truncatedName = displayName.length > 30
    ? `${displayName.substring(0, 27)}...`
    : displayName;

  const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';

  const resolveThumbUrl = (url) => {
    if (!url || typeof url !== 'string') {
      return null;
    }

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const baseCandidate =
      process.env.REACT_APP_API_BASE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    if (!baseCandidate) {
      return url;
    }

    try {
      return new URL(url, baseCandidate).toString();
    } catch (err) {
      console.warn('[ImageLayer] Failed to resolve thumbnail URL', err);
      return url;
    }
  };

  const resolvedThumbUrl = resolveThumbUrl(image.thumb_url);

  if (typeof document === 'undefined') {
    return `
      <div class="image-popup">
        <div class="image-popup-name">${truncatedName}</div>
        <div class="image-popup-coords"><small>${Number(image.lat).toFixed(4)}°, ${Number(image.lon).toFixed(4)}°</small></div>
      </div>
    `;
  }

  const detail = {
    object_key: image.object_key,
    original_filename: image.original_filename,
    lat: Number(image.lat),
    lon: Number(image.lon),
    metadata_id: image.metadata_id || null,
  };

  const container = document.createElement('div');
  container.className = 'image-popup';

  const thumbnailWrapper = document.createElement('div');
  thumbnailWrapper.className = 'image-popup-thumbnail';

  const imageEl = document.createElement('img');
  imageEl.alt = displayName;
  imageEl.src = resolvedThumbUrl || placeholderImage;
  imageEl.style.display = 'none';
  imageEl.onload = () => {
    imageEl.style.display = 'block';
  };
  imageEl.onerror = () => {
    if (imageEl.src !== placeholderImage) {
      imageEl.src = placeholderImage;
    }
    imageEl.style.display = 'block';
  };
  thumbnailWrapper.appendChild(imageEl);
  container.appendChild(thumbnailWrapper);

  const nameEl = document.createElement('div');
  nameEl.className = 'image-popup-name';
  nameEl.title = displayName;
  nameEl.textContent = truncatedName;
  container.appendChild(nameEl);

  const coordsEl = document.createElement('div');
  coordsEl.className = 'image-popup-coords';
  const coordsText = document.createElement('small');
  coordsText.textContent = `${detail.lat.toFixed(4)}°, ${detail.lon.toFixed(4)}°`;
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
  noteDisplay.textContent = existingNote || 'Add a note about this moment…';
  if (!existingNote) {
    noteDisplay.classList.add('muted');
  }
  noteContainer.appendChild(noteDisplay);

  const noteEditor = document.createElement('textarea');
  noteEditor.className = 'image-popup-note-editor';
  noteEditor.value = existingNote;
  noteEditor.style.display = 'none';
  noteContainer.appendChild(noteEditor);

  const noteActions = document.createElement('div');
  noteActions.className = 'image-popup-note-actions';
  noteActions.style.display = 'none';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ghost';
  cancelBtn.textContent = 'Cancel';
  noteActions.appendChild(saveBtn);
  noteActions.appendChild(cancelBtn);
  noteContainer.appendChild(noteActions);

  const toggleEditor = (show) => {
    noteEditor.style.display = show ? 'block' : 'none';
    noteActions.style.display = show ? 'flex' : 'none';
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

  cancelBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    noteEditor.value = existingNote;
    toggleEditor(false);
  });

  saveBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    const newNote = noteEditor.value;
    try {
      await updatePhotoNote(detail.metadata_id || detail.object_key, {
        note: newNote,
        note_title: newNote ? newNote.split('\n')[0] : null,
      });
      noteDisplay.textContent = newNote || 'Add a note about this moment…';
      if (newNote) {
        noteDisplay.classList.remove('muted');
      } else {
        noteDisplay.classList.add('muted');
      }
      toggleEditor(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('photoNoteUpdated', {
            detail: {
              object_key: detail.object_key,
              metadata_id: detail.metadata_id || detail.object_key,
              note: newNote,
              note_title: newNote ? newNote.split('\n')[0] : null,
            },
          })
        );
      }
    } catch (err) {
      console.error('[ImageLayer] Failed to save note', err);
      alert('Failed to save note. Please try again.');
    }
  });

  container.appendChild(noteContainer);

  const buttonEl = document.createElement('button');
  buttonEl.className = 'image-popup-button';
  buttonEl.type = 'button';
  buttonEl.textContent = 'View Details';
  container.appendChild(buttonEl);

  const dispatchSelection = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mapImageSelected', { detail }));
      window.dispatchEvent(new CustomEvent('viewImageDetails', { detail }));
    }
    if (typeof onMarkerSelected === 'function') {
      onMarkerSelected(image);
    }
  };

  const attachSelectionHandler = (node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      dispatchSelection();
    });
  };

  attachSelectionHandler(buttonEl);
  attachSelectionHandler(thumbnailWrapper);
  attachSelectionHandler(nameEl);

  return container;
}

export default ImageLayer;
