// client/src/components/panels/ImageGalleryPanel.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listImageFiles, getImageUrl, getImageVariantUrl, normalizeImageUrl, getFileMetadata, deleteImage } from '../../services/api';
import '../../styles/ImageGalleryPanel.css';

function ImageGalleryPanel({ tripId, onDataChange, readOnly }) {
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageMetadata, setImageMetadata] = useState({});
  const [hoveredImage, setHoveredImage] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [deleting, setDeleting] = useState(null);
  const [syncedSelection, setSyncedSelection] = useState(null);
  const imageItemRefs = useRef({});
  const pendingScrollRef = useRef(null);
  const imageFilesRef = useRef([]);
  const showImagesRef = useRef(false);

  useEffect(() => {
    imageFilesRef.current = imageFiles;
  }, [imageFiles]);

  useEffect(() => {
    showImagesRef.current = showImages;
  }, [showImages]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const files = await listImageFiles(tripId);
      const normalizedFiles = Array.isArray(files) ? files : [];
      console.log('[ImageGalleryPanel] Loaded images:', normalizedFiles);

      // Backend now returns a flat FileMetadataResponse. Keep backward compatibility by
      // storing the full item as metadata when nested metadata is absent.
      const preloadedMetadata = normalizedFiles.reduce((acc, item) => {
        if (item?.object_key) {
          acc[item.object_key] = item.metadata || item;
        }
        return acc;
      }, {});

      setImageFiles(normalizedFiles);
      setImageMetadata((prev) => ({
        ...prev,
        ...preloadedMetadata,
      }));
    } catch (error) {
      console.error('[ImageGalleryPanel] Error loading images:', error);
      setImageFiles([]);
      setImageMetadata({});
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const hasValidGps = (gps) => {
    if (!gps) return false;
    const lat = Number(gps.latitude);
    const lon = Number(gps.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    return !(lat === 0 && lon === 0);
  };

  // Listen for image upload events
  useEffect(() => {
    const handleImageUpload = () => {
      if (showImages) {
        loadImages();
        if (typeof onDataChange === 'function') {
          onDataChange();
        }
      }
    };

    window.addEventListener('imageUploaded', handleImageUpload);
    return () => window.removeEventListener('imageUploaded', handleImageUpload);
  }, [showImages, loadImages, onDataChange]);

  const toggleImagesPanel = async () => {
    if (!showImages) {
      await loadImages();
    }
    setShowImages(!showImages);
  };

  const getCapturedValue = (metadata) => {
    return metadata?.captured_at || metadata?.date_taken || null;
  };

  const formatCapturedLabel = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  };

  const getMetadataForImage = useCallback((filename) => {
    return (
      imageMetadata[filename] ||
      imageFiles.find((item) => item?.object_key === filename)?.metadata ||
      imageFiles.find((item) => item?.object_key === filename) ||
      null
    );
  }, [imageMetadata, imageFiles]);

  const handleImageClick = (filename) => {
    setSelectedImage(filename);
    setSyncedSelection(filename);
    // Load metadata for the selected image
    loadMetadataForImage(filename);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const loadMetadataForImage = useCallback(async (filename) => {
    const cached = getMetadataForImage(filename);

    // Only skip refetch if GPS is already present and valid
    if (hasValidGps(cached?.gps)) return cached; // Only skip when GPS is good

    try {
      const metadata = await getFileMetadata(filename);
      setImageMetadata(prev => ({
        ...prev,
        [filename]: metadata
      }));
      return metadata;
    } catch (error) {
      console.error('[ImageGalleryPanel] Error loading metadata:', error);
      return cached || null;
    }
  }, [getMetadataForImage]);

  const handleImageHover = async (filename, event) => {
    setHoveredImage(filename);
    setTooltipPosition({ x: event.clientX, y: event.clientY });

    // Load metadata if not already loaded
    if (!getMetadataForImage(filename)) {
      await loadMetadataForImage(filename);
    }
  };

  const handleImageLeave = () => {
    setHoveredImage(null);
  };

  const handleViewOnMap = async (filename, event, metadataOverride = null, options = {}) => {
    if (event) {
      event.stopPropagation();
    }

    let metadata = metadataOverride || getMetadataForImage(filename);
    if (!metadata) {
      metadata = await loadMetadataForImage(filename);
    }

    const gps = metadata?.gps;
    const lat = Number(gps?.latitude);
    const lon = Number(gps?.longitude);
    if (!hasValidGps(gps)) {
      alert('This image does not have GPS coordinates to show on the map.');
      return;
    }

    if (options.closeDetail && selectedImage === filename) {
      setSelectedImage(null);
    }

    setSyncedSelection(filename);
    window.dispatchEvent(new CustomEvent('centerMapOnLocation', {
      detail: {
        object_key: filename,
        lat,
        lng: lon,
        preventViewer: true,
        source: 'image-gallery',
      }
    }));
  };

  const handleDeleteImage = async (filename, event) => {
    event.stopPropagation(); // Prevent opening modal

    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    setDeleting(filename);
    try {
      await deleteImage(filename, 'images');

      // Remove from state
      setImageFiles(prev => prev.filter(item => item.object_key !== filename));

      // Remove metadata from cache
      setImageMetadata(prev => {
        const newMetadata = { ...prev };
        delete newMetadata[filename];
        return newMetadata;
      });

      // Close modal if this image was open
      if (selectedImage === filename) {
        setSelectedImage(null);
      }

      if (syncedSelection === filename) {
        setSyncedSelection(null);
      }

      // Dispatch imageDeleted event for map layer and other listeners
      window.dispatchEvent(new CustomEvent('imageDeleted', {
        detail: {
          object_key: filename,
          filename: filename
        }
      }));

      console.log(`[ImageGalleryPanel] Deleted image: ${filename}`);
      if (typeof onDataChange === 'function') {
        onDataChange();
      }
    } catch (error) {
      console.error('[ImageGalleryPanel] Error deleting image:', error);
      alert(`Failed to delete image: ${error.response?.data?.detail?.message || error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    const handleMapImageSelected = async (event) => {
      const { object_key } = event.detail || {};
      if (!object_key) return;

      setSyncedSelection(object_key);
      pendingScrollRef.current = object_key;

      if (!showImagesRef.current) {
        setShowImages(true);
      }

      const exists = imageFilesRef.current.some(
        (item) => item?.object_key === object_key
      );
      if (!exists) {
        await loadImages();
      }
    };

    window.addEventListener('mapImageSelected', handleMapImageSelected);
    return () => window.removeEventListener('mapImageSelected', handleMapImageSelected);
  }, [loadImages]);

  useEffect(() => {
    if (!pendingScrollRef.current || !showImages) {
      return;
    }

    const targetKey = pendingScrollRef.current;
    const node = imageItemRefs.current[targetKey];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingScrollRef.current = null;
    }
  }, [imageFiles, showImages]);

  useEffect(() => {
    const handleViewImageDetails = async (event) => {
      const { object_key } = event.detail || {};
      if (!object_key) return;

      setSyncedSelection(object_key);
      pendingScrollRef.current = object_key;

      if (!showImagesRef.current) {
        setShowImages(true);
      }

      const exists = imageFilesRef.current.some(
        (item) => item?.object_key === object_key
      );
      if (!exists) {
        await loadImages();
      }

      setSelectedImage(object_key);
      await loadMetadataForImage(object_key);
    };

    window.addEventListener('viewImageDetails', handleViewImageDetails);
    return () => window.removeEventListener('viewImageDetails', handleViewImageDetails);
  }, [loadImages, loadMetadataForImage]);

  const renderTooltip = (filename) => {
    const metadata = getMetadataForImage(filename);
    if (!metadata) return null;

    const hasLocation =
      metadata?.gps &&
      Number.isFinite(Number(metadata.gps.latitude)) &&
      Number.isFinite(Number(metadata.gps.longitude));

    return (
      <div
        className="image-tooltip"
        style={{
          position: 'fixed',
          left: `${tooltipPosition.x + 15}px`,
          top: `${tooltipPosition.y + 15}px`,
          zIndex: 10000
        }}
      >
        <div className="tooltip-content">
          <div className="tooltip-section">
            <strong>📁 File Info</strong>
            <div>Name: {metadata.original_filename || filename}</div>
            {metadata.size && <div>Size: {(metadata.size / 1024).toFixed(1)} KB</div>}
            {metadata.mime_type && <div>Type: {metadata.mime_type}</div>}
          </div>

          {hasLocation && (
            <div className="tooltip-section">
              <strong>📍 Location</strong>
              <div>Latitude: {Number(metadata.gps.latitude).toFixed(6)}°</div>
              <div>Longitude: {Number(metadata.gps.longitude).toFixed(6)}°</div>
              {metadata.gps.altitude && (
                <div>Altitude: {Number(metadata.gps.altitude).toFixed(1)}m</div>
              )}
            </div>
          )}

          {getCapturedValue(metadata) && (
            <div className="tooltip-section">
              <strong>⏱ Captured At</strong>
              <div>{formatCapturedLabel(getCapturedValue(metadata))}</div>
            </div>
          )}

          {(metadata.camera_make || metadata.camera_model) && (
            <div className="tooltip-section">
              <strong>📷 Camera</strong>
              {metadata.camera_make && <div>{metadata.camera_make}</div>}
              {metadata.camera_model && <div>{metadata.camera_model}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderImageInfo = (filename) => {
    const metadata = getMetadataForImage(filename);
    if (!metadata) return <div className="image-info">{filename}</div>;

    const hasLocation =
      metadata?.gps &&
      Number.isFinite(Number(metadata.gps.latitude)) &&
      Number.isFinite(Number(metadata.gps.longitude));

    return (
      <div className="image-info-detailed">
        <h3>{metadata.original_filename || filename}</h3>

        <div className="metadata-grid">
          <div className="metadata-section">
            <h4>File Information</h4>
            {metadata.size && <p>Size: {(metadata.size / 1024).toFixed(1)} KB</p>}
            {metadata.mime_type && <p>Type: {metadata.mime_type}</p>}
            {metadata.created_at && <p>Uploaded: {new Date(metadata.created_at).toLocaleString()}</p>}
          </div>

          {hasLocation && (
            <div className="metadata-section">
              <h4>GPS Location</h4>
              <p>Latitude: {Number(metadata.gps.latitude).toFixed(6)}°</p>
              <p>Longitude: {Number(metadata.gps.longitude).toFixed(6)}°</p>
              {metadata.gps.altitude && <p>Altitude: {Number(metadata.gps.altitude).toFixed(1)}m</p>}
              <button
                className="view-on-map-btn"
                onClick={(event) => handleViewOnMap(filename, event, metadata, { closeDetail: true })}
              >
                View on Map
              </button>
            </div>
          )}

          {getCapturedValue(metadata) && (
            <div className="metadata-section">
              <h4>Date & Time</h4>
              <p>{formatCapturedLabel(getCapturedValue(metadata))}</p>
            </div>
          )}

          {(metadata.camera_make || metadata.camera_model) && (
            <div className="metadata-section">
              <h4>Camera</h4>
              {metadata.camera_make && <p>Make: {metadata.camera_make}</p>}
              {metadata.camera_model && <p>Model: {metadata.camera_model}</p>}
            </div>
          )}

          {metadata.exif && Object.keys(metadata.exif).length > 0 && (
            <div className="metadata-section full-width">
              <h4>Additional EXIF Data</h4>
              <details>
                <summary>View All EXIF Tags ({Object.keys(metadata.exif).length})</summary>
                <div className="exif-details">
                  {Object.entries(metadata.exif)
                    .filter(([key]) => !['GPSInfo', 'MakerNote', 'UserComment'].includes(key))
                    .slice(0, 20)
                    .map(([key, value]) => (
                      <div key={key} className="exif-row">
                        <span className="exif-key">{key}:</span>
                        <span className="exif-value">{String(value).substring(0, 100)}</span>
                      </div>
                    ))
                  }
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ImageGalleryPanel">
      <button onClick={toggleImagesPanel} className="toggle-button">
        {showImages ? 'Hide Images' : 'Show Images'}
      </button>

      {showImages && (
        <div className="images-container">
          <h4>Uploaded Images ({imageFiles.length})</h4>

          {loading ? (
            <p>Loading images...</p>
          ) : imageFiles.length === 0 ? (
            <p>No images uploaded yet.</p>
          ) : (
            <div className="image-grid">
              {imageFiles.map((item, idx) => {
                const filename = item?.object_key || `image-${idx}`;
                const metadata = getMetadataForImage(filename);
                const hasValidGpsFlag = hasValidGps(metadata?.gps);

                return (
                  <div
                    key={filename}
                    ref={(el) => {
                      if (el) {
                        imageItemRefs.current[filename] = el;
                      } else {
                        delete imageItemRefs.current[filename];
                      }
                    }}
                    className={`image-thumbnail ${syncedSelection === filename ? 'selected' : ''}`}
                    onClick={() => handleImageClick(filename)}
                    onMouseEnter={(e) => handleImageHover(filename, e)}
                    onMouseLeave={handleImageLeave}
                    onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
                  >
                    {(() => {
                      const thumbSrc = normalizeImageUrl(item?.thumb_url, 'thumb') || getImageVariantUrl(filename, 'thumb');
                      const previewSrc = normalizeImageUrl(item?.preview_url, 'preview') || getImageVariantUrl(filename, 'preview');
                      return (
                        <img
                          src={thumbSrc}
                          srcSet={`${thumbSrc} 400w, ${previewSrc} 800w`}
                          sizes="(min-width: 1024px) 200px, 50vw"
                          alt={filename}
                          title={filename}
                          loading="lazy"
                          decoding="async"
                          style={{ aspectRatio: '4 / 3', objectFit: 'cover' }}
                        />
                      );
                    })()}
                    <div className="image-name">
                      <span className="image-name-text">
                        {metadata?.original_filename || filename}
                      </span>
                      {hasValidGpsFlag && (
                        <button
                          className="view-on-map-chip"
                          onClick={(event) => handleViewOnMap(filename, event, metadata)}
                          title="View this image on the map"
                        >
                          View on map
                        </button>
                      )}
                    </div>
                    {metadata?.gps && hasValidGpsFlag && (
                      <div className="gps-indicator" title="Has GPS location">📍</div>
                    )}
                    {!readOnly && (
                      <button
                        className="delete-button"
                        onClick={(e) => handleDeleteImage(filename, e)}
                        disabled={deleting === filename}
                        title="Delete image"
                      >
                        {deleting === filename ? '⏳' : '🗑️'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tooltip for hover */}
      {hoveredImage && renderTooltip(hoveredImage)}

      {/* Image Modal for full-size view */}
      {selectedImage && (
        <div className="image-modal" onClick={closeImageModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeImageModal}>×</button>
            {!readOnly && (
              <button
                className="modal-delete-button"
                onClick={(e) => handleDeleteImage(selectedImage, e)}
                disabled={deleting === selectedImage}
                title="Delete image"
              >
                {deleting === selectedImage ? '⏳ Deleting...' : '🗑️ Delete'}
              </button>
            )}
            <div className="modal-layout">
              <div className="modal-image">
                <img
                  src={getImageVariantUrl(selectedImage, 'preview')}
                  srcSet={`${getImageVariantUrl(selectedImage, 'preview')} 800w, ${getImageUrl(selectedImage, 'original')} 1600w`}
                  sizes="(min-width: 1024px) 70vw, 90vw"
                  alt={selectedImage}
                  loading="lazy"
                  decoding="async"
                  style={{ maxHeight: '70vh', objectFit: 'contain' }}
                />
                <div className="modal-actions">
                  <a
                    href={getImageUrl(selectedImage, 'original')}
                    target="_blank"
                    rel="noreferrer"
                    className="download-original"
                  >
                    Download original
                  </a>
                </div>
              </div>
              <div className="modal-sidebar">
                {renderImageInfo(selectedImage)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageGalleryPanel;
