// client/src/components/views/LeafletMapView.js
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { riversData, listGpxFiles, fetchGpxFile } from '../../services/api';
import 'leaflet/dist/leaflet.css';
import '../../styles/LeafletMapView.css';

// Component to handle map layer changes
function MapLayerController({ selectedLayer }) {
  const map = useMap();
  
  useEffect(() => {
    // Remove all tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });
    
    // Add new tile layer based on selection
    const tileUrls = {
      'openstreetmap': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'rudy map': 'https://tile.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png',
      'mapbox': 'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}'
    };
    
    const attributions = {
      'openstreetmap': '© OpenStreetMap contributors',
      'rudy map': 'Map data © Rudy contributors',
      'mapbox': '© Mapbox contributors'
    };
    
    L.tileLayer(tileUrls[selectedLayer] || tileUrls['openstreetmap'], {
      attribution: attributions[selectedLayer] || attributions['openstreetmap'],
      maxZoom: 19
    }).addTo(map);
  }, [selectedLayer, map]);
  
  return null;
}

// Component to handle GPX file centering
function GPXCenterController({ gpxCenter }) {
  const map = useMap();
  
  useEffect(() => {
    if (gpxCenter) {
      map.setView(gpxCenter, 15);
    }
  }, [gpxCenter, map]);
  
  return null;
}

function LeafletMapView({ selectedLayer, setSelectedLayer, selectedRivers }) {
  const [riverGeoJSON, setRiverGeoJSON] = useState({});
  const [loading, setLoading] = useState(true);
  const [gpxFiles, setGpxFiles] = useState([]);
  const [showGpx, setShowGpx] = useState(false);
  const [selectedGpx, setSelectedGpx] = useState(null);
  const [gpxCenter, setGpxCenter] = useState(null);
  const mapRef = useRef(null);

  // Load river GeoJSON data once on mount
  useEffect(() => {
    const loadRiverData = async () => {
      try {
        console.log('Loading river GeoJSON data...');
        const data = await riversData();
        console.log('River data loaded:', Object.keys(data).length, 'rivers');
        setRiverGeoJSON(data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading river data:', error);
        setLoading(false);
      }
    };
    loadRiverData();
  }, []);

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
      setGpxCenter(latLon);
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

  const getGeoJSONStyle = (riverName) => {
    // Different colors for different rivers
    const colors = [
      '#3388ff', '#ff7800', '#00ff00', '#ff00ff', '#00ffff',
      '#ff0000', '#0000ff', '#ffff00', '#ff00aa', '#00aaff'
    ];
    const index = Object.keys(riverGeoJSON).indexOf(riverName);
    return {
      color: colors[index % colors.length],
      weight: 2,
      opacity: 0.7,
      fillOpacity: 0.3
    };
  };

  return (
    <div className="leaflet-map-view">
      {/* Layer selector in top-left */}
      <select 
        className="layer-selector"
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

      {/* Loading indicator */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading river data...</div>
        </div>
      )}

      {/* Leaflet Map Container */}
      <MapContainer
        center={[24.7553, 121.2906]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        {/* Map layer controller */}
        <MapLayerController selectedLayer={selectedLayer} />
        
        {/* GPX center controller */}
        <GPXCenterController gpxCenter={gpxCenter} />
        
        {/* Default tile layer (will be replaced by MapLayerController) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
        />

        {/* Render selected river GeoJSON layers */}
        {!loading && selectedRivers.map((riverName) => {
          const geoJson = riverGeoJSON[riverName];
          if (!geoJson) return null;
          
          return (
            <GeoJSON
              key={riverName}
              data={geoJson}
              style={getGeoJSONStyle(riverName)}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`<strong>${riverName}</strong>`);
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

export default LeafletMapView;
