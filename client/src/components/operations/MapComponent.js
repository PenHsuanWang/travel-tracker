// client/src/components/operations/MapComponent.js
import React, { useEffect, useState } from 'react';
import {
  generateMap,
  getMapLayers,
  getUploadedData,
  listGpxFiles, // Make sure this is exported in api.js
} from '../../services/api';

const MapComponent = () => {
  const [mapHtml, setMapHtml] = useState('');
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState('openstreetmap');

  // 1) For "Uploaded Data" drop-down
  const [uploadedData, setUploadedData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 2) For GPX files drop-down
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpxDropdown, setShowGpxDropdown] = useState(false);

  // Fetch map layers on mount
  useEffect(() => {
    const fetchLayers = async () => {
      try {
        const data = await getMapLayers();
        if (Array.isArray(data)) {
          setLayers(data);
          if (data.length > 0 && !selectedLayer) {
            setSelectedLayer(data[0]);
          }
        } else {
          console.error('Expected array but received:', data);
        }
      } catch (error) {
        console.error('Error fetching layers:', error);
      }
    };
    fetchLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate map whenever selectedLayer changes
  useEffect(() => {
    if (selectedLayer) {
      const fetchMap = async () => {
        try {
          const html = await generateMap(selectedLayer);
          setMapHtml(html);
        } catch (error) {
          console.error('Error fetching map:', error);
        }
      };
      fetchMap();
    }
  }, [selectedLayer]);

  const handleLayerChange = (event) => {
    setSelectedLayer(event.target.value);
  };

  // Toggle for "uploaded data" drop-down
  const handleToggleDropdown = async () => {
    if (!showDropdown) {
      try {
        const data = await getUploadedData();
        setUploadedData(data);
      } catch (error) {
        console.error('Error fetching uploaded data:', error);
      }
    }
    setShowDropdown(!showDropdown);
  };

  // Toggle for GPX files drop-down
  const handleToggleGpxDropdown = async () => {
    if (!showGpxDropdown) {
      try {
        // Pass 'gps-data' bucket if your backend expects it
        const files = await listGpxFiles('gps-data');
        setGpxFiles(files);
      } catch (error) {
        console.error('Error fetching GPX files:', error);
      }
    }
    setShowGpxDropdown(!showGpxDropdown);
  };

  return (
    <div className="map-container" style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* LAYER SELECTOR (TOP-LEFT) */}
      <select onChange={handleLayerChange} value={selectedLayer}>
        {layers.map((layer) => (
          <option key={layer} value={layer}>
            {layer}
          </option>
        ))}
      </select>

      {/* 1) "UPLOADED DATA" TOGGLE & DROPDOWN (TOP-RIGHT) */}
      <button
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 12px',
        }}
        onClick={handleToggleDropdown}
      >
        {showDropdown ? 'Hide Uploaded Data' : 'Show Uploaded Data'}
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            width: '200px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: '10px' }}>
            {uploadedData.length === 0 ? (
              <li>No uploaded data found.</li>
            ) : (
              uploadedData.map((item, index) => (
                <li key={index} style={{ margin: '5px 0' }}>
                  {item.name}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* 2) "GPX FILES" TOGGLE & DROPDOWN (SHIFTED LOWER) */}
      <button
        style={{
          position: 'absolute',
          top: '100px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 12px',
        }}
        onClick={handleToggleGpxDropdown}
      >
        {showGpxDropdown ? 'Hide GPX Files' : 'Show GPX Files'}
      </button>

      {showGpxDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '140px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            width: '200px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: '10px' }}>
            {gpxFiles.length === 0 ? (
              <li>No GPX files found.</li>
            ) : (
              gpxFiles.map((filename, index) => (
                <li key={index} style={{ margin: '5px 0' }}>
                  {filename}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* RENDER THE MAP HTML */}
      <div
        dangerouslySetInnerHTML={{ __html: mapHtml }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};

export default MapComponent;
