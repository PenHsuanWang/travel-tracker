// client/src/components/views/MapView.js
import React, { useEffect, useState } from 'react';
import { generateMap, listGpxFiles, fetchGpxFile } from '../../services/api';
import '../../styles/MapView.css';

function MapView({ selectedLayer, setSelectedLayer, mapHtml, setMapHtml }) {
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpx, setShowGpx] = useState(false);
  const [selectedGpx, setSelectedGpx] = useState(null);

  useEffect(() => {
    // Generate default map when user changes layer
    const generateDefaultMap = async () => {
      try {
        const html = await generateMap(selectedLayer, null);
        setMapHtml(html);
      } catch (err) {
        console.error('Error generating default map:', err);
      }
    };
    generateDefaultMap();
  }, [selectedLayer]);

  const toggleGpxDropdown = async () => {
    if (!showGpx) {
      try {
        const files = await listGpxFiles();
        setGpxFiles(files);
      } catch (err) {
        console.error('Error listing GPX files:', err);
      }
    }
    setShowGpx(!showGpx);
  };

  const handleGpxClick = async (filename) => {
    setSelectedGpx(filename);
    try {
      const arrayBuffer = await fetchGpxFile(filename, 'gps-data');
      const latLon = parseFirstLatLon(arrayBuffer);
      if (!latLon) {
        console.warn('No valid track point found in GPX file:', filename);
        return;
      }
      const html = await generateMap(selectedLayer, latLon);
      setMapHtml(html);
    } catch (err) {
      console.error('Error fetching gpx file:', err);
    }
  };

  const parseFirstLatLon = (arrayBuffer) => {
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

  return (
    <div className="MapView">
      {/* Layer selector in top-left (like your mock-up) */}
      <select className="layer-selector"
        value={selectedLayer}
        onChange={(e) => setSelectedLayer(e.target.value)}
      >
        <option value="openstreetmap">openstreetmap</option>
        <option value="rudy map">rudy map</option>
        <option value="mapbox">mapbox</option>
      </select>

      {/* GPX toggle in top-right */}
      <button className="gpx-toggle" onClick={toggleGpxDropdown}>
        {showGpx ? 'Hide GPX Files' : 'Show GPX Files'}
      </button>

      {/* GPX file list (if shown) */}
      {showGpx && (
        <div className="gpx-dropdown">
          <ul>
            {gpxFiles.length === 0 ? (
              <li>No GPX files found.</li>
            ) : (
              gpxFiles.map((file, idx) => (
                <li
                  key={idx}
                  onClick={() => handleGpxClick(file)}
                  className={selectedGpx === file ? 'selected' : ''}
                >
                  {file}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Render Folium map HTML */}
      <div
        className="map-html"
        dangerouslySetInnerHTML={{ __html: mapHtml }}
      />
    </div>
  );
}

export default MapView;