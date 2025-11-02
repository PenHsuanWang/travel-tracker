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
   * Listen for image upload events
   */
  useEffect(() => {
    const handleImageUploaded = (event) => {
      console.log('[ImageLayer] Image uploaded event received');
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

    window.addEventListener('imageUploaded', handleImageUploaded);
    return () => window.removeEventListener('imageUploaded', handleImageUploaded);
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
 * Create HTML content for marker popup
 */
function createPopupContent(image, onImageSelected) {
  const truncatedName = image.original_filename.length > 30
    ? image.original_filename.substring(0, 27) + '...'
    : image.original_filename;

  const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';

  const handleViewDetails = () => {
    if (onImageSelected) {
      onImageSelected(image);
    }
    window.dispatchEvent(
      new CustomEvent('viewImageDetails', {
        detail: image,
      })
    );
  };

  return `
    <div class="image-popup">
      <div class="image-popup-thumbnail">
        <img 
          src="${image.thumb_url}" 
          alt="${image.original_filename}"
          onerror="this.src='${placeholderImage}'"
          style="display: none;"
          onload="this.style.display='block'"
        />
      </div>
      <div class="image-popup-name" title="${image.original_filename}">
        ${truncatedName}
      </div>
      <div class="image-popup-coords">
        <small>${image.lat.toFixed(4)}°, ${image.lon.toFixed(4)}°</small>
      </div>
      <button class="image-popup-button" onclick="window.dispatchEvent(new CustomEvent('viewImageDetails', { detail: ${JSON.stringify(image).replace(/"/g, '&quot;')} }))">
        View Details
      </button>
    </div>
  `;
}

export default ImageLayer;

