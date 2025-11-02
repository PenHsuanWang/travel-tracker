// client/src/components/map/ImageLayer.js
import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getGeotaggedImages } from '../../services/api';
import '../../styles/ImageLayer.css';

/**
 * ImageLayer Component
 * 
 * Renders markers for geotagged images on the map using react-leaflet.
 * This component works with the Leaflet map from react-leaflet's useMap hook.
 */
function ImageLayer({ onImageSelected = null }) {
  const map = useMap();
  const [markers, setMarkers] = useState({});
  const [loading, setLoading] = useState(false);

  /**
   * Load geotagged images and create markers
   */
  const loadGeotaggedImages = async () => {
    if (!map) return;

    setLoading(true);

    try {
      console.log('[ImageLayer] Loading geotagged images...');
      const images = await getGeotaggedImages();
      console.log('[ImageLayer] Loaded', images.length, 'geotagged images');

      const newMarkers = {};

      images.forEach((image) => {
        try {
          // Validate GPS coordinates
          if (!Number.isFinite(Number(image.lat)) || !Number.isFinite(Number(image.lon))) {
            console.warn('[ImageLayer] Skipping image with invalid coordinates:', image.object_key);
            return;
          }

          const lat = Number(image.lat);
          const lon = Number(image.lon);

          // Create marker
          const marker = L.marker([lat, lon], {
            title: image.original_filename,
          });

          // Create popup content with thumbnail
          const popupContent = createPopupContent(image, onImageSelected);
          marker.bindPopup(popupContent, { maxWidth: 300 });

          // Add to map
          marker.addTo(map);

          // Store marker by object_key for later removal/updates
          newMarkers[image.object_key] = {
            marker,
            image,
          };

          console.log('[ImageLayer] Created marker for:', image.original_filename, `(${lat}, ${lon})`);
        } catch (err) {
          console.error('[ImageLayer] Error creating marker for', image.object_key, ':', err);
        }
      });

      setMarkers(newMarkers);
    } catch (err) {
      console.error('[ImageLayer] Error loading geotagged images:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initial load when map is ready
   */
  useEffect(() => {
    if (map) {
      loadGeotaggedImages();
    }
  }, [map]);

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
        const marker = L.marker([lat, lon], {
          title: original_filename,
        });

        const image = {
          object_key,
          original_filename,
          lat,
          lon,
          thumb_url,
          metadata_id,
        };

        const popupContent = createPopupContent(image, onImageSelected);
        marker.bindPopup(popupContent, { maxWidth: 300 });
        marker.addTo(map);

        setMarkers((prev) => ({
          ...prev,
          [object_key]: { marker, image },
        }));

        console.log('[ImageLayer] Added marker for newly uploaded image:', original_filename);
      } catch (err) {
        console.error('[ImageLayer] Error adding marker for uploaded image:', err);
      }
    };

    window.addEventListener('imageUploadedWithGPS', handleImageUploadedWithGPS);
    return () => window.removeEventListener('imageUploadedWithGPS', handleImageUploadedWithGPS);
  }, [map, onImageSelected]);

  /**
   * Listen for image delete events
   */
  useEffect(() => {
    const handleImageDeleted = (event) => {
      console.log('[ImageLayer] Image deleted event received');
      const { object_key } = event.detail;

      if (map && markers[object_key]) {
        try {
          markers[object_key].marker.remove();
          setMarkers((prev) => {
            const updated = { ...prev };
            delete updated[object_key];
            return updated;
          });
          console.log('[ImageLayer] Removed marker for deleted image:', object_key);
        } catch (err) {
          console.error('[ImageLayer] Error removing marker:', err);
        }
      }
    };

    window.addEventListener('imageDeleted', handleImageDeleted);
    return () => window.removeEventListener('imageDeleted', handleImageDeleted);
  }, [map, markers]);

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
function createPopupContent(image, onImageSelected) {
  const displayName = getDisplayName(image.original_filename);
  const truncatedName = displayName.length > 30
    ? displayName.substring(0, 27) + '...'
    : displayName;

  const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';

  // Store image data in a way that doesn't require JSON.stringify in onclick
  // Use data attributes instead
  const imageDataKey = `imageData_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  window[imageDataKey] = image;

  return `
    <div class="image-popup">
      <div class="image-popup-thumbnail">
        <img 
          src="${image.thumb_url}" 
          alt="${displayName}"
          onerror="this.src='${placeholderImage}'"
          style="display: none;"
          onload="this.style.display='block'"
        />
      </div>
      <div class="image-popup-name" title="${displayName}">
        ${truncatedName}
      </div>
      <div class="image-popup-coords">
        <small>${image.lat.toFixed(4)}°, ${image.lon.toFixed(4)}°</small>
      </div>
      <button class="image-popup-button" onclick="(function() { const imageData = window['${imageDataKey}']; window.dispatchEvent(new CustomEvent('viewImageDetails', { detail: imageData })); delete window['${imageDataKey}']; })()">
        View Details
      </button>
    </div>
  `;
}

export default ImageLayer;

