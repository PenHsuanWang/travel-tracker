// client/src/components/views/LeafletMapView.js
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
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
  const [selectedGpxFiles, setSelectedGpxFiles] = useState([]);
  const [gpxTracks, setGpxTracks] = useState({});
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
    // Toggle selection
    const isSelected = selectedGpxFiles.includes(filename);
    let newSelection;
    
    if (isSelected) {
      // Deselect: remove from selection and remove track data
      newSelection = selectedGpxFiles.filter(f => f !== filename);
      const newTracks = { ...gpxTracks };
      delete newTracks[filename];
      setGpxTracks(newTracks);
      setSelectedGpxFiles(newSelection);
    } else {
      // Select: add to selection and load track data
      newSelection = [...selectedGpxFiles, filename];
      setSelectedGpxFiles(newSelection);
      
      try {
        const arrayBuffer = await fetchGpxFile(filename, 'gps-data');
        const trackData = parseGpxTrack(arrayBuffer);
        
        if (trackData.coordinates.length > 0) {
          setGpxTracks(prev => ({
            ...prev,
            [filename]: trackData
          }));
          
          // Center map to first point of newly loaded track
          setGpxCenter(trackData.coordinates[0]);
          console.log(`GPX track loaded: ${filename}, ${trackData.coordinates.length} points`);
        } else {
          console.warn('No valid track points found in GPX file:', filename);
        }
      } catch (err) {
        console.error('Error fetching gpx file:', err);
      }
    }
  };

  const parseGpxTrack = (arrayBuffer) => {
    const decoder = new TextDecoder('utf-8');
    const gpxText = decoder.decode(arrayBuffer);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'application/xml');
    
    const coordinates = [];
    let trackName = 'Unnamed Track';
    
    // Try to get track name
    const nameElement = xmlDoc.querySelector('trk > name');
    if (nameElement && nameElement.textContent) {
      trackName = nameElement.textContent;
    }
    
    // Get all track points
    const trkpts = xmlDoc.querySelectorAll('trkpt');
    trkpts.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat'));
      const lon = parseFloat(trkpt.getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) {
        coordinates.push([lat, lon]);
      }
    });
    
    return {
      name: trackName,
      coordinates: coordinates
    };
  };

  const getGpxTrackColor = (filename) => {
    // Different colors for different GPX tracks
    const colors = [
      '#ff0000', // red
      '#00ff00', // green
      '#0000ff', // blue
      '#ff00ff', // magenta
      '#00ffff', // cyan
      '#ff8800', // orange
      '#8800ff', // purple
      '#ffff00', // yellow
      '#ff0088', // pink
      '#00ff88'  // mint
    ];
    const index = gpxFiles.indexOf(filename);
    return colors[index % colors.length];
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
                  className={selectedGpxFiles.includes(file) ? 'selected' : ''}
                >
                  <input
                    type="checkbox"
                    checked={selectedGpxFiles.includes(file)}
                    onChange={() => handleGpxClick(file)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span style={{ 
                    color: selectedGpxFiles.includes(file) ? getGpxTrackColor(file) : 'inherit',
                    marginLeft: '8px'
                  }}>
                    {file}
                  </span>
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

        {/* Render GPX track polylines */}
        {Object.entries(gpxTracks).map(([filename, trackData]) => (
          <Polyline
            key={filename}
            positions={trackData.coordinates}
            pathOptions={{
              color: getGpxTrackColor(filename),
              weight: 3,
              opacity: 0.8
            }}
            eventHandlers={{
              click: () => {
                console.log(`Clicked on track: ${filename}`);
              }
            }}
          >
            {/* Popup for track info */}
          </Polyline>
        ))}
      </MapContainer>
    </div>
  );
}

export default LeafletMapView;
