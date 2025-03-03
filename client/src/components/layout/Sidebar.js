import React, { useRef, useState } from 'react';
import { uploadFile, getUploadedData } from '../../services/api';
import '../../styles/Sidebar.css';

function Sidebar() {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Local state for controlling the drop-down visibility and data
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);

  // Trigger hidden file input for GPS
  const handleGpsClick = () => {
    if (gpsInputRef.current) {
      gpsInputRef.current.value = null; // Reset to allow re-upload of the same file
      gpsInputRef.current.click();
    }
  };

  // Trigger hidden file input for images
  const handleImageClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = null;
      imageInputRef.current.click();
    }
  };

  // Handle GPS file upload
  const handleGpsFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await uploadFile(file);
      console.log('GPS file uploaded successfully:', data);
    } catch (error) {
      console.error('Error uploading GPS file:', error);
    }
  };

  // Handle image file upload
  const handleImageFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await uploadFile(file);
      console.log('Image uploaded successfully:', data);
    } catch (error) {
      console.error('Error uploading image file:', error);
    }
  };

  // Toggle the drop-down and fetch data if opening
  const toggleDropdown = async () => {
    if (!isDropdownOpen) {
      // Only fetch the data when the drop-down is about to open
      try {
        const data = await getUploadedData();
        setUploadedData(data);
      } catch (error) {
        console.error('Error fetching uploaded data:', error);
      }
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <aside className="Sidebar">
      <h2>Upload Data</h2>

      {/* GPS Upload */}
      <button onClick={handleGpsClick}>Upload GPS Data</button>
      <input
        type="file"
        ref={gpsInputRef}
        onChange={handleGpsFileChange}
        style={{ display: 'none' }}
        accept=".gps,.gpx,.txt,application/octet-stream"
      />

      {/* Image Upload */}
      <button onClick={handleImageClick}>Upload Image</button>
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        style={{ display: 'none' }}
        accept="image/*"
      />

      {/* Toggleable Drop-Down for Uploaded Data */}
      <div style={{ marginTop: '20px' }}>
        <button onClick={toggleDropdown}>
          {isDropdownOpen ? 'Hide Uploaded Data' : 'Show Uploaded Data'}
        </button>

        {isDropdownOpen && (
          <ul className="uploaded-data-dropdown">
            {uploadedData.map((item, index) => (
              <li key={index}>
                {item.name /* or any property returned by your API */}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
