// client/src/components/operations/MapComponent.js
import React, { useEffect, useState } from 'react';
import { generateMap, getMapLayers, getUploadedData } from '../../services/api';

const MapComponent = () => {
  const [mapHtml, setMapHtml] = useState('');
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState('openstreetmap');

  // State for uploaded data list and toggle
  const [uploadedData, setUploadedData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch available map layers on component mount
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

  // Whenever the selectedLayer changes, generate a new map
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

  // Toggle the drop-down. When opening, fetch the list of uploaded data.
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

  return (
    <div className="map-container" style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Example layer selector (top-left) */}
      <select onChange={handleLayerChange} value={selectedLayer}>
        {layers.map((layer) => (
          <option key={layer} value={layer}>
            {layer}
          </option>
        ))}
      </select>

      {/* Button to toggle the drop-down (top-right corner) */}
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
        {showDropdown ? 'Hide' : 'Show'} Uploaded Data
      </button>

      {/* Conditionally render the drop-down of uploaded files */}
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

      {/* Render the map HTML */}
      <div
        dangerouslySetInnerHTML={{ __html: mapHtml }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};

export default MapComponent;
