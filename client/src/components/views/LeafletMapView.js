// client/src/components/views/LeafletMapView.js
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { riversData, listGpxFilesWithMeta, fetchGpxAnalysis, deleteFile } from '../../services/api';
import ImageLayer from '../map/ImageLayer';
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

function LeafletMapView({ selectedLayer, setSelectedLayer, selectedRivers, tripId, onImageSelected }) {
  const [riverGeoJSON, setRiverGeoJSON] = useState({});
  const [loading, setLoading] = useState(true);
  const [gpxFiles, setGpxFiles] = useState([]); // detailed metadata entries
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
        const files = await listGpxFilesWithMeta(tripId);
        setGpxFiles(files);
      } catch (err) {
        console.error('Error listing GPX files:', err);
      }
    }
    setShowGpx(!showGpx);
  };

  const handleGpxClick = async (objectKey) => {
    const isSelected = selectedGpxFiles.includes(objectKey);

    if (isSelected) {
      const newSelection = selectedGpxFiles.filter((f) => f !== objectKey);
      const newTracks = { ...gpxTracks };
      delete newTracks[objectKey];
      setSelectedGpxFiles(newSelection);
      setGpxTracks(newTracks);
      return;
    }

    setSelectedGpxFiles((prev) => [...prev, objectKey]);

    try {
      const trackData = await fetchGpxAnalysis(objectKey, tripId);
      if (trackData.coordinates && trackData.coordinates.length > 0) {
        setGpxTracks((prev) => ({
          ...prev,
          [objectKey]: {
            coordinates: trackData.coordinates,
            summary: trackData.track_summary,
            source: trackData.source,
            displayName: trackData.display_name || objectKey,
            waypoints: trackData.waypoints || [],
            rest_points: trackData.rest_points || []
          }
        }));

        setGpxCenter(trackData.coordinates[0]);
        console.log(`GPX track loaded: ${objectKey}, ${trackData.coordinates.length} points via ${trackData.source}`);
      } else {
        console.warn('No valid track points found in GPX file:', objectKey);
      }
    } catch (err) {
      console.error('Error fetching analyzed GPX data:', err);
    }
  };

  const handleDeleteGpx = async (fileItem) => {
    const objectKey = typeof fileItem === 'string' ? fileItem : fileItem.object_key;
    const analysisKey = fileItem?.metadata?.analysis_object_key;
    const analysisBucket = fileItem?.metadata?.analysis_bucket || 'gps-analysis-data';

    const confirmed = window.confirm(`Delete GPX file "${objectKey}"? This will remove the original file, metadata, and analyzed object.`);
    if (!confirmed) return;

    try {
      await deleteFile(objectKey, 'gps-data');
      if (analysisKey) {
        try {
          await deleteFile(analysisKey, analysisBucket);
        } catch (innerErr) {
          console.warn(`Failed to delete analysis object ${analysisKey}:`, innerErr);
        }
      }
      setGpxFiles((prev) => prev.filter((item) => {
        const key = typeof item === 'string' ? item : item.object_key;
        return key !== objectKey;
      }));
      setSelectedGpxFiles((prev) => prev.filter((key) => key !== objectKey));
      setGpxTracks((prev) => {
        const next = { ...prev };
        delete next[objectKey];
        return next;
      });
    } catch (err) {
      console.error('Failed to delete GPX file:', err);
      alert('Failed to delete GPX file. Please try again.');
    }
  };

  const getGpxTrackColor = (objectKey) => {
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
    const index = gpxFiles.findIndex((item) => {
      const key = typeof item === 'string' ? item : item.object_key;
      return key === objectKey;
    });
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
              gpxFiles.map((file) => {
                const objectKey = typeof file === 'string' ? file : file.object_key;
                const label = typeof file === 'string'
                  ? file
                  : (file.metadata?.original_filename || file.metadata?.filename || file.object_key);
                const summary = file.metadata?.track_summary;
                const distanceLabel = summary?.total_distance_km
                  ? `${Number(summary.total_distance_km).toFixed(1)} km`
                  : summary?.total_distance_m
                    ? `${(Number(summary.total_distance_m) / 1000).toFixed(1)} km`
                    : null;
                const restCount = summary?.rest_points_count;
                const sourceLabel = file.metadata?.analysis_status === 'success' ? 'Analyzed' : 'Raw';

                return (
                <li
                  key={objectKey}
                  onClick={() => handleGpxClick(objectKey)}
                  className={selectedGpxFiles.includes(objectKey) ? 'selected' : ''}
                >
                  <input
                    type="checkbox"
                    checked={selectedGpxFiles.includes(objectKey)}
                    onChange={() => handleGpxClick(objectKey)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="gpx-info">
                    <div
                      className="gpx-title"
                      style={{
                        color: selectedGpxFiles.includes(objectKey) ? getGpxTrackColor(objectKey) : 'inherit',
                      }}
                    >
                      {label}
                    </div>
                    <div className="gpx-meta-row">
                      {distanceLabel && <span className="gpx-chip">{distanceLabel}</span>}
                      {typeof restCount === 'number' && <span className="gpx-chip">{restCount} rests</span>}
                      {sourceLabel && <span className="gpx-chip muted">{sourceLabel}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gpx-delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGpx(file);
                    }}
                    title="Delete GPX"
                  >
                    x
                  </button>
                </li>
                );
              })
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

        {/* Render analyzed waypoints and rest points */}
        {Object.entries(gpxTracks).map(([filename, trackData]) => (
          <React.Fragment key={`${filename}-markers`}>
            {(trackData.waypoints || []).map((wp, idx) => (
              <CircleMarker
                key={`${filename}-wp-${idx}`}
                center={[wp.lat, wp.lon]}
                radius={6}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9 }}
              >
                <Popup>
                  <div>
                    <strong>Waypoint</strong>
                    <div>{trackData.displayName || filename}</div>
                    {wp.note && <div>Note: {wp.note}</div>}
                    {wp.time && <div>Time: {wp.time}</div>}
                    {wp.elev !== undefined && wp.elev !== null && <div>Elev: {wp.elev} m</div>}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            {(trackData.rest_points || []).map((rp, idx) => (
              <CircleMarker
                key={`${filename}-rest-${idx}`}
                center={[rp.lat, rp.lon]}
                radius={7}
                pathOptions={{ color: '#d97706', fillColor: '#f59e0b', fillOpacity: 0.95 }}
              >
                <Popup>
                  <div>
                    <strong>Rest point</strong>
                    <div>{trackData.displayName || filename}</div>
                    {rp.start_time && <div>Start: {rp.start_time}</div>}
                    {rp.end_time && <div>End: {rp.end_time}</div>}
                    {rp.rest_minutes !== undefined && rp.rest_minutes !== null && (
                      <div>Rest: {rp.rest_minutes} min</div>
                    )}
                    {rp.elev !== undefined && rp.elev !== null && <div>Elev: {rp.elev} m</div>}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </React.Fragment>
        ))}

        {/* Image Layer - displays markers for geotagged images */}
        <ImageLayer tripId={tripId} onImageSelected={onImageSelected} />
      </MapContainer>
    </div>
  );
}

export default LeafletMapView;
