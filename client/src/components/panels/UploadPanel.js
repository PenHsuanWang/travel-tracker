// client/src/components/panels/UploadPanel.js
import React, { useRef, useState } from 'react';
import { uploadFile, listGpxFiles } from '../../services/api';
import '../../styles/UploadPanel.css';

function UploadPanel({ tripId }) {
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
      const result = await uploadFile(file, tripId);
      console.log('GPS file uploaded:', result);
      // Refresh the list after upload
      if (showUploadedData) {
        const gpxFiles = await listGpxFiles(tripId);
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

    console.log('[UploadPanel] Starting image upload:', file.name, file.type, file.size);

    try {
      const result = await uploadFile(file, tripId);
      console.log('[UploadPanel] Image file uploaded successfully:', result);

      // Show more detailed success message
      let message = `Image uploaded successfully: ${result.filename}`;
      if (result.has_gps) {
        message += `\n📍 GPS Location: ${result.gps.latitude.toFixed(4)}°, ${result.gps.longitude.toFixed(4)}°`;
      }
      if (result.date_taken) {
        message += `\n📅 Date Taken: ${result.date_taken}`;
      }
      alert(message);

      // Trigger custom events to notify listeners (ImageGalleryPanel, ImageLayer, etc.)
      window.dispatchEvent(new CustomEvent('imageUploaded'));

      // If image has GPS, also dispatch imageUploadedWithGPS for map layer
      if (result.has_gps && result.gps) {
        window.dispatchEvent(new CustomEvent('imageUploadedWithGPS', {
          detail: {
            object_key: result.metadata_id,
            original_filename: result.filename,
            gps: result.gps,
            thumb_url: result.file_url,
            metadata_id: result.metadata_id
          }
        }));
      }
    } catch (error) {
      console.error('[UploadPanel] Error uploading image - Full error:', error);
      console.error('[UploadPanel] Error response:', error.response);
      console.error('[UploadPanel] Error message:', error.message);

      // Show more detailed error message
      let errorMessage = 'Failed to upload image. ';
      if (error.response) {
        errorMessage += `Server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage += 'No response from server. Please check if the backend is running.';
      } else {
        errorMessage += `Error: ${error.message}`;
      }

      alert(errorMessage);
    }
  };

  const toggleUploadedData = async () => {
    if (!showUploadedData) {
      try {
        const gpxFiles = await listGpxFiles(tripId);
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
