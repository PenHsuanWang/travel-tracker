// client/src/components/panels/UploadPanel.js
import React, { useRef, useState } from 'react';
import { uploadFile, getUploadedData, listGpxFiles } from '../../services/api';
import '../../styles/UploadPanel.css';

function UploadPanel() {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Whether or not to show the “uploaded” section
  const [showUploadedData, setShowUploadedData] = useState(false);

  // For listing general uploaded data (images, text, etc.)
  const [uploadedData, setUploadedData] = useState([]);
  // For listing GPX files specifically
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
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  // Toggle to show/hide the entire “uploaded” data section, including GPX files
  const toggleUploadedData = async () => {
    if (!showUploadedData) {
      try {
        // 1) Fetch any “uploaded” data from your backend
        const data = await getUploadedData();
        setUploadedData(data || []);

        // 2) Fetch the list of GPX files from MinIO
        const gpxFiles = await listGpxFiles();
        setGpxList(gpxFiles || []);
      } catch (error) {
        console.error('Error fetching uploaded data or GPX files:', error);
      }
    }
    setShowUploadedData(!showUploadedData);
  };

  return (
    <div className="UploadPanel">
      <h2>Upload Data</h2>

      {/* Row of upload buttons */}
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

      {/* Show/hide the “uploaded data” section */}
      <button onClick={toggleUploadedData} style={{ marginTop: '10px' }}>
        {showUploadedData ? 'Hide Uploaded Data' : 'Show Uploaded Data'}
      </button>

      {showUploadedData && (
        <div style={{ marginTop: '10px' }}>
          {/* Example: Display general “uploadedData” items from your backend */}
          <h4>Other Uploaded Items</h4>
          {uploadedData.length === 0 ? (
            <p>No items found.</p>
          ) : (
            <ul className="uploaded-data-list">
              {uploadedData.map((item, idx) => (
                <li key={idx}>{item.name}</li>
              ))}
            </ul>
          )}

          {/* List of GPX files (previously in the main content area) */}
          <h4 style={{ marginTop: '15px' }}>Uploaded GPX Files</h4>
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