// client/src/components/upload/UploadPanel.js
import React, { useRef, useState } from 'react';
import { uploadFile, getUploadedData } from '../../services/api';
import '../../styles/UploadPanel.css';

function UploadPanel() {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [isUploadedDataOpen, setIsUploadedDataOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);

  // Trigger file selection for GPS
  const handleGpsClick = () => {
    if (gpsInputRef.current) {
      gpsInputRef.current.value = null;
      gpsInputRef.current.click();
    }
  };
  // Upload selected GPS file
  const handleGpsFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await uploadFile(file);
      console.log('GPS file uploaded:', data);
    } catch (error) {
      console.error('Error uploading GPS file:', error);
    }
  };

  // Same for images
  const handleImageClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = null;
      imageInputRef.current.click();
    }
  };
  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await uploadFile(file);
      console.log('Image file uploaded:', data);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  // Show or hide previously uploaded data
  const toggleUploadedDataDropdown = async () => {
    if (!isUploadedDataOpen) {
      try {
        const data = await getUploadedData();
        setUploadedData(data);
      } catch (error) {
        console.error('Error fetching uploaded data:', error);
      }
    }
    setIsUploadedDataOpen(!isUploadedDataOpen);
  };

  return (
    <div className="UploadPanel">
      <h2>Upload Data</h2>

      {/* Buttons to upload GPS and Image */}
      <button onClick={handleGpsClick}>Upload GPS Data</button>
      <input
        type="file"
        ref={gpsInputRef}
        onChange={handleGpsFileChange}
        style={{ display: 'none' }}
        accept=".gps,.gpx,.txt,application/octet-stream"
      />

      <button onClick={handleImageClick}>Upload Image</button>
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        style={{ display: 'none' }}
        accept="image/*"
      />

      {/* Toggle to see previously uploaded data */}
      <div style={{ marginTop: '20px' }}>
        <button onClick={toggleUploadedDataDropdown}>
          {isUploadedDataOpen ? 'Hide Uploaded Data' : 'Show Uploaded Data'}
        </button>
        {isUploadedDataOpen && (
          <ul className="uploaded-data-dropdown">
            {uploadedData.map((item, idx) => (
              <li key={idx}>{item.name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default UploadPanel;