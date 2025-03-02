// client/src/components/operations/MapComponent.js
import React, { useEffect, useState } from 'react';
import {
  generateMap,
  getMapLayers,
  getUploadedData,
  listGpxFiles,
  fetchGpxFile,
} from '../../services/api';

function MapComponent() {
  const [mapHtml, setMapHtml] = useState('');
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState('openstreetmap');

  // "Uploaded Data" dropdown
  const [uploadedData, setUploadedData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // GPX dropdown
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpxDropdown, setShowGpxDropdown] = useState(false);

  useEffect(() => {
    const fetchLayers = async () => {
      try {
        const data = await getMapLayers();
        setLayers(data);
      } catch (error) {
        console.error('Error fetching layers:', error);
      }
    };
    fetchLayers();
  }, []);

  // Generate default map on mount
  useEffect(() => {
    if (selectedLayer) {
      generateDefaultMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer]);

  const generateDefaultMap = async () => {
    try {
      const html = await generateMap(selectedLayer, null); // no center
      setMapHtml(html);
    } catch (error) {
      console.error('Error generating default map:', error);
    }
  };

  // Toggle "uploaded data"
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

  // Toggle "GPX files"
  const handleToggleGpxDropdown = async () => {
    if (!showGpxDropdown) {
      try {
        const files = await listGpxFiles('gps-data');
        setGpxFiles(files);
      } catch (error) {
        console.error('Error listing GPX files:', error);
      }
    }
    setShowGpxDropdown(!showGpxDropdown);
  };

  // Parse the first lat/lon from GPX
  const parseFirstLatLonFromGpx = (arrayBuffer) => {
    const decoder = new TextDecoder('utf-8');
    const gpxText = decoder.decode(arrayBuffer);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'application/xml');
    const trkpt = xmlDoc.querySelector('trkpt');
    if (!trkpt) return null;

    const lat = parseFloat(trkpt.getAttribute('lat'));
    const lon = parseFloat(trkpt.getAttribute('lon'));
    if (isNaN(lat) || isNaN(lon)) return null;

    return [lat, lon];
  };

  // When user clicks a GPX filename
  const handleGpxClick = async (filename) => {
    try {
      const arrayBuffer = await fetchGpxFile(filename, 'gps-data');
      const firstLatLon = parseFirstLatLonFromGpx(arrayBuffer);

      if (!firstLatLon) {
        console.warn('No valid track point found in GPX file:', filename);
        return;
      }

      // Re-generate map with new center
      const html = await generateMap(selectedLayer, firstLatLon);
      setMapHtml(html);

    } catch (error) {
      console.error('Error fetching/centering on GPX file:', error);
    }
  };

  return (
    <div className="map-container" style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* LAYER SELECTOR */}
      <select value={selectedLayer} onChange={(e) => setSelectedLayer(e.target.value)}>
        {layers.map((layer) => (
          <option key={layer} value={layer}>
            {layer}
          </option>
        ))}
      </select>

      {/* 1) UPLOADED DATA DROPDOWN */}
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

      {/* 2) GPX FILES DROPDOWN */}
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
                <li
                  key={index}
                  style={{ margin: '5px 0', cursor: 'pointer' }}
                  onClick={() => handleGpxClick(filename)}
                >
                  {filename}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Render the map HTML from the backend */}
      <div
        dangerouslySetInnerHTML={{ __html: mapHtml }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}

export default MapComponent;
