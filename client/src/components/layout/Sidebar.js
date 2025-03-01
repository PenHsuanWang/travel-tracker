import React, { useRef } from 'react';
import { uploadFile } from '../../services/api';
import '../../styles/Sidebar.css';

function Sidebar() {
  const gpsInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Trigger the hidden GPS file input.
  const handleGpsClick = () => {
    if (gpsInputRef.current) {
      gpsInputRef.current.value = null; // Reset in case same file is selected repeatedly.
      gpsInputRef.current.click();
    }
  };

  // Trigger the hidden image file input.
  const handleImageClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = null;
      imageInputRef.current.click();
    }
  };

  // Handle GPS file upload.
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

  // Handle image file upload.
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
    </aside>
  );
}

export default Sidebar;
