// client/src/components/layout/Sidebar.js
import React, { useState, useEffect, useRef } from 'react';
import {
  uploadFile,
  getUploadedData,
  listRivers,
  generateGisMap
} from '../../services/api';
import '../../styles/Sidebar.css';

function Sidebar({ selectedLayer, mapHtml, setMapHtml }) {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // "Show Uploaded Data" state
  const [isUploadedDataOpen, setIsUploadedDataOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);

  // Rivers dropdown
  const [showRiversDropdown, setShowRiversDropdown] = useState(false);
  const [riverNames, setRiverNames] = useState([]);
  const [selectedRivers, setSelectedRivers] = useState([]);

  // Load rivers from backend
  useEffect(() => {
    const fetchRiverNames = async () => {
      try {
        const data = await listRivers();
        setRiverNames(data);
      } catch (error) {
        console.error('Error fetching river names:', error);
      }
    };
    fetchRiverNames();
  }, []);

  // --- GPS & Image Upload (optional) ---
  const handleGpsClick = () => {
    if (gpsInputRef.current) {
      gpsInputRef.current.value = null;
      gpsInputRef.current.click();
    }
  };
  const handleGpsFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = await uploadFile(file);
      console.log('GPS file uploaded:', data);
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
  const handleImageFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = await uploadFile(file);
      console.log('Image file uploaded:', data);
    } catch (error) {
      console.error('Error uploading image file:', error);
    }
  };

  // --- Show Uploaded Data ---
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

  // --- Rivers Dropdown ---
  const toggleRiversDropdown = () => {
    setShowRiversDropdown(!showRiversDropdown);
  };

  const handleRiverCheckboxChange = (river) => {
    if (selectedRivers.includes(river)) {
      setSelectedRivers(selectedRivers.filter((r) => r !== river));
    } else {
      setSelectedRivers([...selectedRivers, river]);
    }
  };

  const handleGenerateGisMap = async () => {
    try {
      const html = await generateGisMap(selectedLayer, null, selectedRivers);
      setMapHtml(html);
    } catch (error) {
      console.error('Error generating GIS map:', error);
    }
  };

  return (
    <aside className="Sidebar">
      <h2>Upload Data</h2>
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

      {/* Show Uploaded Data */}
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

      {/* Rivers Dropdown */}
      <div style={{ marginTop: '20px' }}>
        <button onClick={toggleRiversDropdown}>
          {showRiversDropdown ? 'Hide Rivers' : 'Show Rivers'}
        </button>
        {showRiversDropdown && (
          <div
            style={{
              marginTop: '10px',
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #ccc',
              padding: '5px'
            }}
          >
            {riverNames.length === 0 ? (
              <p>No rivers found.</p>
            ) : (
              riverNames.map((river, idx) => (
                <div key={idx}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedRivers.includes(river)}
                      onChange={() => handleRiverCheckboxChange(river)}
                    />
                    {river}
                  </label>
                </div>
              ))
            )}
          </div>
        )}
        {showRiversDropdown && riverNames.length > 0 && (
          <button onClick={handleGenerateGisMap} style={{ marginTop: '10px' }}>
            Generate GIS Map
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
