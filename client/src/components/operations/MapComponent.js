// client/src/components/operations/MapComponent.js
import React, { useEffect, useState } from 'react';
import { generateMap, listGpxFiles, fetchGpxFile } from '../../services/api';
import MapToolbox from './MapToolbox';
import '../../styles/MapComponent.css';

function MapComponent({ selectedLayer, setSelectedLayer, mapHtml, setMapHtml }) {
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpxDropdown, setShowGpxDropdown] = useState(false);
  const [selectedGpxFile, setSelectedGpxFile] = useState(null);

  // Generate default map on layer change
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

  const toggleGpxDropdown = async () => {
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
    <div className="map-container">
      {/* Layer selector in top-left */}
      <select
        className="layer-selector"
        value={selectedLayer}
        onChange={(e) => setSelectedLayer(e.target.value)}
      >
        <option value="openstreetmap">OpenStreetMap</option>
        <option value="rudy map">Rudy Map</option>
        <option value="mapbox">Mapbox</option>
      </select>

      {/* GPX Files toggle in top-right */}
      <button className="gpx-toggle-button" onClick={toggleGpxDropdown}>
        {showGpxDropdown ? 'Hide GPX Files' : 'Show GPX Files'}
      </button>

      {showGpxDropdown && (
        <div className="gpx-dropdown">
          <ul>
            {gpxFiles.length === 0 ? (
              <li>No GPX files found.</li>
            ) : (
              gpxFiles.map((filename, idx) => (
                <li
                  key={idx}
                  onClick={() => handleGpxClick(filename)}
                  className={selectedGpxFile === filename ? 'selected' : ''}
                >
                  {filename}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Embedded Map Toolbox */}
      <MapToolbox />

      {/* Render the generated map HTML */}
      <div
        className="map-html-container"
        dangerouslySetInnerHTML={{ __html: mapHtml }}
      />
    </div>
  );
}

export default MapComponent;