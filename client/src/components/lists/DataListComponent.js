// client/src/components/lists/DataListComponent.js
import React, { useState, useEffect } from 'react';
import { listGpxFiles } from '../../services/api';

function DataListComponent() {
  const [gpxList, setGpxList] = useState([]);

  useEffect(() => {
    const fetchGpxFiles = async () => {
      try {
        const files = await listGpxFiles();
        setGpxList(files);
      } catch (error) {
        console.error('Error fetching GPX files:', error);
      }
    };
    fetchGpxFiles();
  }, []);

  return (
    <div>
      <h2>List of Uploaded GPX Files</h2>
      {gpxList.length === 0 ? (
        <p>No GPX files found in MinIO bucket.</p>
      ) : (
        <ul>
          {gpxList.map((filename, index) => (
            <li key={index}>{filename}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DataListComponent;