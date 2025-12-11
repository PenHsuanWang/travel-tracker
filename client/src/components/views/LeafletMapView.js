// client/src/components/views/LeafletMapView.js
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { riversData } from '../../services/api';
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
      'rudy map': 'https://tile.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png',
      'happyman': 'https://tile.happyman.idv.tw/map/moi_osm/{z}/{x}/{y}.png',
      'openstreetmap': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    };

    const attributions = {
      'rudy map': 'Map data © Rudy contributors',
      'happyman': 'Map data © Happyman contributors',
      'openstreetmap': '© OpenStreetMap contributors'
    };

    L.tileLayer(tileUrls[selectedLayer] || tileUrls['rudy map'], {
      attribution: attributions[selectedLayer] || attributions['rudy map'],
      maxZoom: 19
    }).addTo(map);
  }, [selectedLayer, map]);

  return null;
}

// Component to handle GPX file centering
function GPXCenterController({ gpxTrack }) {
  const map = useMap();

  useEffect(() => {
    if (gpxTrack && gpxTrack.coordinates && gpxTrack.coordinates.length > 0) {
      try {
        const bounds = L.latLngBounds(gpxTrack.coordinates);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.error("Error fitting bounds:", e);
      }
    }
  }, [gpxTrack, map]);

  return null;
}

function LeafletMapView({
  selectedLayer,
  setSelectedLayer,
  selectedRivers,
  tripId,
  onImageSelected,
  mapRef: externalMapRef,
  // Refactored props
  gpxTrack,
  highlightedItemId,
  readOnly,
  photos,
  onPhotoUpdate
}) {
  const [riverGeoJSON, setRiverGeoJSON] = useState({});
  const [loading, setLoading] = useState(false);
  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;

  // Load river GeoJSON data lazily when a river is selected
  useEffect(() => {
    const loadRiverData = async () => {
      // Only fetch if user selected a river AND we haven't loaded data yet
      if (selectedRivers.length > 0 && Object.keys(riverGeoJSON).length === 0) {
        try {
          setLoading(true);
          console.log('Loading river GeoJSON data...');
          const data = await riversData();
          console.log('River data loaded:', Object.keys(data).length, 'rivers');
          setRiverGeoJSON(data);
        } catch (error) {
          console.error('Error loading river data:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadRiverData();
  }, [selectedRivers, riverGeoJSON]);

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

  const buildPinMarkup = (fillColor, strokeColor) => (
    `
      <div class="waypoint-pin-wrapper">
        <svg class="waypoint-pin-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="3" fill="#fff" stroke="none" />
        </svg>
      </div>
    `
  );

  const waypointIcon = useMemo(() => L.divIcon({
    className: 'waypoint-pin',
    html: buildPinMarkup('#f59e0b', '#78350f'),
    iconSize: [36, 48],
    iconAnchor: [18, 46],
    popupAnchor: [0, -40],
    tooltipAnchor: [0, -40]
  }), []);

  const restPointIcon = useMemo(() => L.divIcon({
    className: 'waypoint-pin waypoint-pin--rest',
    html: buildPinMarkup('#38bdf8', '#0c4a6e'),
    iconSize: [36, 48],
    iconAnchor: [18, 46],
    popupAnchor: [0, -40],
    tooltipAnchor: [0, -40]
  }), []);

  // Highlight icon for hovered items
  const highlightIcon = useMemo(() => L.divIcon({
    className: 'waypoint-pin waypoint-pin--highlight',
    html: buildPinMarkup('#ef4444', '#7f1d1d'), // Red highlight
    iconSize: [42, 56], // Slightly larger
    iconAnchor: [21, 54],
    popupAnchor: [0, -48],
    tooltipAnchor: [0, -48]
  }), []);

  return (
    <div className="leaflet-map-view">
      {/* Layer selector in top-right */}
      <select
        className="layer-selector"
        value={selectedLayer}
        onChange={(e) => setSelectedLayer(e.target.value)}
      >
        <option value="rudy map">rudy map</option>
        <option value="happyman">happyman</option>
        <option value="openstreetmap">openstreetmap</option>
      </select>

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
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
      >
        {/* Map layer controller */}
        <MapLayerController selectedLayer={selectedLayer} />

        {/* GPX center controller */}
        <GPXCenterController gpxTrack={gpxTrack} />

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

        {/* Render GPX track polyline */}
        {gpxTrack && gpxTrack.coordinates && (
          <Polyline
            positions={gpxTrack.coordinates}
            pathOptions={{
              color: '#ff0000', // Default red for the single track
              weight: 3,
              opacity: 0.8
            }}
          />
        )}

        {/* Render analyzed waypoints and rest points */}
        {gpxTrack && (
          <React.Fragment>
            {(gpxTrack.waypoints || []).map((wp, idx) => {
              const waypointTitle = wp.name || wp.title || 'Waypoint';
              const noteRaw = wp.note ?? wp.user_note;
              const noteText = typeof noteRaw === 'string' ? noteRaw.trim() : '';
              const descRaw = wp.desc ?? wp.description;
              const descText = typeof descRaw === 'string' ? descRaw.trim() : '';
              const id = `waypoint-${gpxTrack.source || 'track'}-${idx}`;
              
              return (
                <Marker
                  key={`wp-${idx}-${waypointTitle}-${noteText}`}
                  position={[wp.lat, wp.lon]}
                  icon={highlightedItemId === id ? highlightIcon : waypointIcon}
                  riseOnHover
                  zIndexOffset={highlightedItemId === id ? 1000 : 0}
                >
                  <Tooltip direction="top" offset={[0, -34]} opacity={1} className="map-tooltip" sticky>
                    <div className="map-tooltip__title">{waypointTitle}</div>
                    {!!noteText && (
                      <div className="map-tooltip__note map-tooltip__note--highlight">{noteText}</div>
                    )}
                    {!noteText && !!descText && (
                      <div className="map-tooltip__note">{descText}</div>
                    )}
                    {wp.elev !== undefined && wp.elev !== null && (
                      <div className="map-tooltip__meta">Elev: {wp.elev} m</div>
                    )}
                  </Tooltip>
                  <Popup>
                    <div className="map-popup">
                      <div className="map-popup__title">{waypointTitle}</div>
                      <div className="map-popup__row">{gpxTrack.displayName}</div>
                      {noteText && <div className="map-popup__row">Note: {noteText}</div>}
                      {wp.time && <div className="map-popup__row">Time: {wp.time}</div>}
                      {wp.elev !== undefined && wp.elev !== null && (
                        <div className="map-popup__row">Elev: {wp.elev} m</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {(gpxTrack.rest_points || []).map((rp, idx) => (
              <Marker
                key={`rest-${idx}`}
                position={[rp.lat, rp.lon]}
                icon={restPointIcon}
                riseOnHover
              >
                <Tooltip direction="top" offset={[0, -34]} opacity={1} className="map-tooltip">
                  <div className="map-tooltip__title">Rest point</div>
                  <div className="map-tooltip__note">
                    {rp.rest_minutes ? `${rp.rest_minutes} min break` : 'Rest stop'}
                  </div>
                  {rp.elev !== undefined && rp.elev !== null && (
                    <div className="map-tooltip__meta">Elev: {rp.elev} m</div>
                  )}
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <div className="map-popup__title">Rest point</div>
                    <div className="map-popup__row">{gpxTrack.displayName}</div>
                    {rp.start_time && <div className="map-popup__row">Start: {rp.start_time}</div>}
                    {rp.end_time && <div className="map-popup__row">End: {rp.end_time}</div>}
                    {rp.rest_minutes !== undefined && rp.rest_minutes !== null && (
                      <div className="map-popup__row">Rest: {rp.rest_minutes} min</div>
                    )}
                    {rp.elev !== undefined && rp.elev !== null && (
                      <div className="map-popup__row">Elev: {rp.elev} m</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </React.Fragment>
        )}

        {/* Image Layer - displays markers for geotagged images */}
        <ImageLayer 
          tripId={tripId} 
          onImageSelected={onImageSelected} 
          readOnly={readOnly} 
          photos={photos}
          onPhotoUpdate={onPhotoUpdate}
        />
      </MapContainer>
    </div>
  );
}

export default LeafletMapView;
