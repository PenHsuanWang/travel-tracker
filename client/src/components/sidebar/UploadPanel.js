import React from 'react';
import '../../styles/UploadPanel.css';
import { uploadFile } from '../../services/api';

function UploadPanel({ setMapHtml }) {
  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadFile(file);
    // Optionally re-fetch map or notify user
  };

  return (
    <div className="upload-panel">
      <label className="upload-button">
        Upload GPX
        <input type="file" accept=".gpx" hidden onChange={handleFile} />
      </label>
      <label className="upload-button">
        Upload Image
        <input type="file" accept="image/*" hidden onChange={handleFile} />
      </label>
    </div>
  );
}

export default UploadPanel;