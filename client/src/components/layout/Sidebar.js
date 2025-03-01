// src/components/layout/Sidebar.js
import React, { useRef } from 'react';
import axios from 'axios';
import '../../styles/Sidebar.css';

function Sidebar() {
  // References to the hidden file inputs:
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Trigger the hidden file input for GPS
  const handleGpsClick = () => {
    if (gpsInputRef.current) {
      gpsInputRef.current.value = null;  // reset in case user selects same file repeatedly
      gpsInputRef.current.click();
    }
  };

  // Trigger the hidden file input for Image
  const handleImageClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = null;
      imageInputRef.current.click();
    }
  };

  // Called when the user selects a GPS file
  const handleGpsFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return; // user may have canceled

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Post to your backend endpoint
      // e.g., http://localhost:5002/api/map/upload
      const response = await axios.post('http://localhost:5002/api/map/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('GPS file uploaded successfully:', response.data);
      // response.data should contain { filename: "...", file_url: "..." }
      // The "file_url" is the location in MinIO (or your storage).
    } catch (error) {
      console.error('Error uploading GPS file:', error);
    }
  };

  // Called when the user selects an Image file
  const handleImageFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('http://localhost:5002/api/map/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Image uploaded successfully:', response.data);
    } catch (error) {
      console.error('Error uploading image file:', error);
    }
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
        accept=".gps,.gpx,.txt,application/octet-stream" // optional, restrict file types
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
    </aside>
  );
}

export default Sidebar;