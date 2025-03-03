import React, { useState } from 'react';
import { uploadFile } from '../../services/api';

function UploadComponent() {
  const [gpsFile, setGpsFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const handleGpsFileChange = (event) => {
    setGpsFile(event.target.files[0]);
  };

  const handleImageFileChange = (event) => {
    setImageFile(event.target.files[0]);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    try {
      const data = await uploadFile(file);
      console.log('File uploaded successfully:', data);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  return (
    <div>
      <h2>Upload Data</h2>
      <div>
        <input type="file" onChange={handleGpsFileChange} />
        <button onClick={() => handleUpload(gpsFile)}>Upload GPS Data</button>
      </div>
      <div>
        <input type="file" onChange={handleImageFileChange} />
        <button onClick={() => handleUpload(imageFile)}>Upload Image</button>
      </div>
    </div>
  );
};

export default UploadComponent;
