import React, { useState } from 'react';
import axios from 'axios';

function UploadComponent() {
  const [gpsFile, setGpsFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const handleGpsFileChange = (event) => {
    setGpsFile(event.target.files[0]);
  };

  const handleImageFileChange = (event) => {
    setImageFile(event.target.files[0]);
  };

  const handleUpload = (file, type) => {
    const formData = new FormData();
    formData.append('file', file);

    axios.post(`/api/upload/${type}`, formData)
      .then(response => console.log(response.data))
      .catch(error => console.error(error));
  };

  return (
    <div>
      <h2>Upload Data</h2>
      <div>
        <input type="file" onChange={handleGpsFileChange} />
        <button onClick={() => handleUpload(gpsFile, 'gps')}>Upload GPS Data</button>
      </div>
      <div>
        <input type="file" onChange={handleImageFileChange} />
        <button onClick={() => handleUpload(imageFile, 'image')}>Upload Image</button>
      </div>
    </div>
  );
};

export default UploadComponent;