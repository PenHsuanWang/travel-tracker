// client/src/components/operations/MapComponent.js
import React, { useEffect, useState } from 'react';
import { generateMap, listGpxFiles, fetchGpxFile } from '../../services/api';

function MapComponent({ selectedLayer, setSelectedLayer, mapHtml, setMapHtml }) {
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpxDropdown, setShowGpxDropdown] = useState(false);
  const [selectedGpxFile, setSelectedGpxFile] = useState(null);

  // Generate a default map whenever the user changes the layer
  useEffect(() => {
    const generateDefaultMap = async () => {
      try {
        const html = await generateMap(selectedLayer, null);
        setMapHtml(html);
      } catch (error) {
        console.error('Error generating default map:', error);
      }
    };
    generateDefaultMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer]);

  // Toggle the GPX dropdown
  const handleToggleGpxDropdown = async () => {
    if (!showGpxDropdown) {
      try {
        const files = await listGpxFiles();
        setGpxFiles(files);
      } catch (error) {
        console.error('Error listing GPX files:', error);
      }
    }
    setShowGpxDropdown(!showGpxDropdown);
  };

  // Basic parser for the first lat/lon in a GPX file
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

  // Center the map on the selected GPX file
  const handleGpxClick = async (filename) => {
    try {
      setSelectedGpxFile(filename);
      const arrayBuffer = await fetchGpxFile(filename, 'gps-data');
      const firstLatLon = parseFirstLatLonFromGpx(arrayBuffer);
      if (!firstLatLon) {
        console.warn('No valid track point found in GPX file:', filename);
        return;
      }
      const html = await generateMap(selectedLayer, firstLatLon);
      setMapHtml(html);
    } catch (error) {
      console.error('Error fetching/centering on GPX file:', error);
    }
  };

  return (
    <div
      className="map-container"
      style={{ position: 'relative', height: '100%', width: '100%' }}
    >
      {/* TOP-LEFT CONTAINER (layer selector, other controls) */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px', // space between stacked items
        }}
      >
        {/* LAYER SELECTOR */}
        <select
          value={selectedLayer}
          onChange={(e) => setSelectedLayer(e.target.value)}
          style={{ padding: '6px' }}
        >
          <option value="openstreetmap">openstreetmap</option>
          <option value="rudy map">rudy map</option>
          <option value="mapbox">mapbox</option>
        </select>
      </div>

      {/* TOP-RIGHT CONTAINER (GPX toggle button, then dropdown) */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px', // space between stacked items
        }}
      >
        {/* GPX TOGGLE BUTTON */}
        <button
          onClick={handleToggleGpxDropdown}
          style={{ padding: '8px 12px' }}
        >
          {showGpxDropdown ? 'Hide GPX Files' : 'Show GPX Files'}
        </button>

        {/* GPX DROPDOWN (appears below the button without overlap) */}
        {showGpxDropdown && (
          <div
            style={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '220px',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '10px',
            }}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {gpxFiles.length === 0 ? (
                <li>No GPX files found.</li>
              ) : (
                gpxFiles.map((filename, index) => (
                  <li
                    key={index}
                    onClick={() => handleGpxClick(filename)}
                    style={{
                      margin: '5px 0',
                      cursor: 'pointer',
                      backgroundColor:
                        selectedGpxFile === filename ? '#e0e0e0' : 'transparent',
                      fontWeight:
                        selectedGpxFile === filename ? 'bold' : 'normal',
                    }}
                  >
                    {filename}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* FOLIUM MAP HTML */}
      <div
        dangerouslySetInnerHTML={{ __html: mapHtml }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}

export default MapComponent;