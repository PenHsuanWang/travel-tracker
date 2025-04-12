// client/src/components/upload/UploadPanel.js
import React, { useRef, useState } from 'react';
import { uploadFile, getUploadedData } from '../../services/api';
import '../../styles/UploadPanel.css';

function UploadPanel() {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isDataVisible, setIsDataVisible] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);

  const handleFileClick = (inputRef) => {
    if (inputRef.current) {
      inputRef.current.value = null;
      inputRef.current.click();
    }
  };

  const handleFileChange = async (event, fileType) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = await uploadFile(file);
      console.log(`${fileType} file uploaded:`, data);
    } catch (error) {
      console.error(`Error uploading ${fileType} file:`, error);
    }
  };

  const toggleUploadedData = async () => {
    if (!isDataVisible) {
      try {
        const data = await getUploadedData();
        setUploadedData(data);
      } catch (error) {
        console.error('Error fetching uploaded data:', error);
      }
    }
    setIsDataVisible(!isDataVisible);
  };

  return (
    <div className="UploadPanel">
      <h2>Upload Data</h2>
      <button onClick={() => handleFileClick(gpsInputRef)}>Upload GPS Data</button>
      <input
        type="file"
        ref={gpsInputRef}
        onChange={(e) => handleFileChange(e, 'GPS')}
        style={{ display: 'none' }}
        accept=".gps,.gpx,.txt,application/octet-stream"
      />

      <button onClick={() => handleFileClick(imageInputRef)}>Upload Image</button>
      <input
        type="file"
        ref={imageInputRef}
        onChange={(e) => handleFileChange(e, 'Image')}
        style={{ display: 'none' }}
        accept="image/*"
      />

      <div className="uploaded-data-section">
        <button onClick={toggleUploadedData}>
          {isDataVisible ? 'Hide Uploaded Data' : 'Show Uploaded Data'}
        </button>
        {isDataVisible && (
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