// client/src/components/operations/MapComponent.js
import React, { useEffect, useState } from 'react';
import { generateMap, listGpxFiles, fetchGpxFile } from '../../services/api';

function MapComponent({
  selectedLayer,
  setSelectedLayer,
  mapHtml,
  setMapHtml
}) {
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpxDropdown, setShowGpxDropdown] = useState(false);
  const [selectedGpxFile, setSelectedGpxFile] = useState(null);

  // Generate the default map whenever user changes the layer
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

  // Minimal parser to get first lat/lon from a GPX file
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

  // When user clicks a GPX file, center the map on it
  const handleGpxClick = async (filename) => {
    try {
      setSelectedGpxFile(filename);
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
    <div
      className="map-container"
      style={{ position: 'relative', height: '100%', width: '100%' }}
    >
      {/* LAYER SELECTOR (top-left) */}
      <select
        style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000 }}
        value={selectedLayer}
        onChange={(e) => setSelectedLayer(e.target.value)}
      >
        <option value="openstreetmap">openstreetmap</option>
        <option value="rudy map">rudy map</option>
        <option value="mapbox">mapbox</option>
      </select>

      {/* SHOW GPX FILES (top-right) */}
      <button
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 12px',
        }}
        onClick={handleToggleGpxDropdown}
      >
        {showGpxDropdown ? 'Hide GPX Files' : 'Show GPX Files'}
      </button>

      {/* GPX DROPDOWN */}
      {showGpxDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '10px',
            zIndex: 1000,
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
                    backgroundColor: selectedGpxFile === filename ? '#e0e0e0' : 'transparent',
                    fontWeight: selectedGpxFile === filename ? 'bold' : 'normal',
                  }}
                >
                  {filename}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Comment out or remove the dynamic MapToolbox approach */}
      {/* <MapToolbox /> */}

      {/* RENDER THE FOLIUM MAP HTML */}
      <div
        dangerouslySetInnerHTML={{ __html: mapHtml }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}

export default MapComponent;