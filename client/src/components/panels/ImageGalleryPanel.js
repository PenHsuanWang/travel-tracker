// client/src/components/panels/ImageGalleryPanel.js
import React, { useState, useEffect } from 'react';
import { listImageFiles, getImageUrl } from '../../services/api';
import '../../styles/ImageGalleryPanel.css';

function ImageGalleryPanel() {
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const loadImages = async () => {
    setLoading(true);
    try {
      const files = await listImageFiles();
      console.log('[ImageGalleryPanel] Loaded images:', files);
      setImageFiles(files || []);
    } catch (error) {
      console.error('[ImageGalleryPanel] Error loading images:', error);
      setImageFiles([]);
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
  };

  const closeImageModal = () => {
    setSelectedImage(null);
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
              {imageFiles.map((filename, idx) => (
                <div 
                  key={idx} 
                  className="image-thumbnail"
                  onClick={() => handleImageClick(filename)}
                >
                  <img 
                    src={getImageUrl(filename)} 
                    alt={filename}
                    title={filename}
                  />
                  <div className="image-name">{filename}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Modal for full-size view */}
      {selectedImage && (
        <div className="image-modal" onClick={closeImageModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeImageModal}>×</button>
            <img 
              src={getImageUrl(selectedImage)} 
              alt={selectedImage}
            />
            <div className="image-info">{selectedImage}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageGalleryPanel;
