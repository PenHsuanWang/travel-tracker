// client/src/components/panels/ImageGalleryPanel.js
import React, { useState, useEffect } from 'react';
import { listImageFiles, getImageUrl, getFileMetadata, deleteImage } from '../../services/api';
import '../../styles/ImageGalleryPanel.css';

function ImageGalleryPanel() {
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageMetadata, setImageMetadata] = useState({});
  const [hoveredImage, setHoveredImage] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [deleting, setDeleting] = useState(null);

  const loadImages = async () => {
    setLoading(true);
    try {
      const files = await listImageFiles();
      const normalizedFiles = Array.isArray(files) ? files : [];
      console.log('[ImageGalleryPanel] Loaded images:', normalizedFiles);

      const preloadedMetadata = normalizedFiles.reduce((acc, item) => {
        if (item?.object_key && item.metadata) {
          acc[item.object_key] = item.metadata;
        }
        return acc;
      }, {});

      setImageFiles(normalizedFiles);
      setImageMetadata(preloadedMetadata);
    } catch (error) {
      console.error('[ImageGalleryPanel] Error loading images:', error);
      setImageFiles([]);
      setImageMetadata({});
    } finally {
      setLoading(false);
    }
  };

  // Listen for image upload events
  useEffect(() => {
    const handleImageUpload = () => {
      if (showImages) {
        loadImages();
      }
    };
    
    window.addEventListener('imageUploaded', handleImageUpload);
    return () => window.removeEventListener('imageUploaded', handleImageUpload);
  }, [showImages]);

  const toggleImagesPanel = async () => {
    if (!showImages) {
      await loadImages();
    }
    setShowImages(!showImages);
  };

  const handleImageClick = (filename) => {
    setSelectedImage(filename);
    // Load metadata for the selected image
    loadMetadataForImage(filename);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const loadMetadataForImage = async (filename) => {
    const cached = imageMetadata[filename];
    
    // Only skip refetch if GPS is already present and valid
    const hasValidGps =
      cached?.gps &&
      Number.isFinite(Number(cached.gps.latitude)) &&
      Number.isFinite(Number(cached.gps.longitude));
    
    if (hasValidGps) return; // Only skip when GPS is good
    
    try {
      const metadata = await getFileMetadata(filename);
      setImageMetadata(prev => ({
        ...prev,
        [filename]: metadata
      }));
    } catch (error) {
      console.error('[ImageGalleryPanel] Error loading metadata:', error);
    }
  };

  const handleImageHover = async (filename, event) => {
    setHoveredImage(filename);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
    
    // Load metadata if not already loaded
    if (!imageMetadata[filename]) {
      await loadMetadataForImage(filename);
    }
  };

  const handleImageLeave = () => {
    setHoveredImage(null);
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
      
      // Dispatch imageDeleted event for map layer and other listeners
      window.dispatchEvent(new CustomEvent('imageDeleted', {
        detail: {
          object_key: filename,
          filename: filename
        }
      }));
      
      console.log(`[ImageGalleryPanel] Deleted image: ${filename}`);
    } catch (error) {
      console.error('[ImageGalleryPanel] Error deleting image:', error);
      alert(`Failed to delete image: ${error.response?.data?.detail?.message || error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const renderTooltip = (filename) => {
    const metadata = imageMetadata[filename];
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
          
          {metadata.date_taken && (
            <div className="tooltip-section">
              <strong>📅 Date Taken</strong>
              <div>{metadata.date_taken}</div>
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
    const metadata = imageMetadata[filename];
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
                onClick={() => {
                  // Dispatch event to center map on this location
                  window.dispatchEvent(new CustomEvent('centerMapOnLocation', {
                    detail: {
                      lat: metadata.gps.latitude,
                      lng: metadata.gps.longitude
                    }
                  }));
                }}
              >
                View on Map
              </button>
            </div>
          )}

          {metadata.date_taken && (
            <div className="metadata-section">
              <h4>Date & Time</h4>
              <p>{metadata.date_taken}</p>
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
                return (
                  <div 
                    key={filename}
                    className="image-thumbnail"
                    onClick={() => handleImageClick(filename)}
                    onMouseEnter={(e) => handleImageHover(filename, e)}
                    onMouseLeave={handleImageLeave}
                    onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
                  >
                    <img 
                      src={getImageUrl(filename)} 
                      alt={filename}
                      title={filename}
                    />
                    <div className="image-name">
                      {imageMetadata[filename]?.original_filename || filename}
                    </div>
                    {imageMetadata[filename]?.gps && (
                      <div className="gps-indicator" title="Has GPS location">📍</div>
                    )}
                    <button
                      className="delete-button"
                      onClick={(e) => handleDeleteImage(filename, e)}
                      disabled={deleting === filename}
                      title="Delete image"
                    >
                      {deleting === filename ? '⏳' : '🗑️'}
                    </button>
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
            <button 
              className="modal-delete-button" 
              onClick={(e) => handleDeleteImage(selectedImage, e)}
              disabled={deleting === selectedImage}
              title="Delete image"
            >
              {deleting === selectedImage ? '⏳ Deleting...' : '🗑️ Delete'}
            </button>
            <div className="modal-layout">
              <div className="modal-image">
                <img 
                  src={getImageUrl(selectedImage)} 
                  alt={selectedImage}
                />
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
