// client/src/components/panels/UploadPanel.js
import React, { useRef, useState } from 'react';
import { uploadFile, listGpxFiles } from '../../services/api';
import '../../styles/UploadPanel.css';

function UploadPanel() {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [showUploadedData, setShowUploadedData] = useState(false);
  const [gpxList, setGpxList] = useState([]);

  const handleGpsClick = () => {
    if (gpsInputRef.current) {
      gpsInputRef.current.value = null;
      gpsInputRef.current.click();
    }
  };

  const handleGpsChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await uploadFile(file);
      console.log('GPS file uploaded:', result);
      // Refresh the list after upload
      if (showUploadedData) {
        const gpxFiles = await listGpxFiles();
        setGpxList(gpxFiles || []);
      }
    } catch (error) {
      console.error('Error uploading GPS file:', error);
    }
  };

  const handleImageClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = null;
      imageInputRef.current.click();
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await uploadFile(file);
      console.log('Image file uploaded:', result);
      
      // Show more detailed success message
      let message = `Image uploaded successfully: ${result.filename}`;
      if (result.has_gps) {
        message += `\n📍 GPS Location: ${result.gps.latitude.toFixed(4)}°, ${result.gps.longitude.toFixed(4)}°`;
      }
      if (result.date_taken) {
        message += `\n📅 Date Taken: ${result.date_taken}`;
      }
      alert(message);
      
      // Trigger a custom event to notify ImageGalleryPanel
      window.dispatchEvent(new CustomEvent('imageUploaded'));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const toggleUploadedData = async () => {
    if (!showUploadedData) {
      try {
        const gpxFiles = await listGpxFiles();
        console.log('[UploadPanel] GPX files:', gpxFiles);
        setGpxList(gpxFiles || []);
      } catch (error) {
        console.error('[UploadPanel] Error fetching GPX files:', error);
        setGpxList([]);
      }
    }
    setShowUploadedData(!showUploadedData);
  };

  return (
    <div className="UploadPanel">
      <h2>Upload Data</h2>

      <div className="button-row">
        <button onClick={handleGpsClick}>Upload GPS</button>
        <input
          type="file"
          ref={gpsInputRef}
          onChange={handleGpsChange}
          style={{ display: 'none' }}
          accept=".gps,.gpx,.txt,application/octet-stream"
        />

        <button onClick={handleImageClick}>Upload Image</button>
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageChange}
          style={{ display: 'none' }}
          accept="image/*"
        />
      </div>

      <button onClick={toggleUploadedData} style={{ marginTop: '10px' }}>
        {showUploadedData ? 'Hide Uploaded Data' : 'Show Uploaded Data'}
      </button>

      {showUploadedData && (
        <div style={{ marginTop: '10px' }}>
          <h4>Uploaded GPX Files</h4>
          {gpxList.length === 0 ? (
            <p>No GPX files found.</p>
          ) : (
            <ul className="uploaded-data-list">
              {gpxList.map((filename, idx) => (
                <li key={idx}>{filename}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPanel;
