// components/map/MapToolbar.js
import React from 'react';
import '../../styles/MapToolbar.css';

function MapToolbar({ selectedLayer, setSelectedLayer }) {
  return (
    <div className="map-toolbar">
      <label>Layer:</label>
      <select
        value={selectedLayer}
        onChange={(e) => setSelectedLayer(e.target.value)}
      >
        <option value="openstreetmap">OpenStreetMap</option>
        <option value="rudymap">Rudy Map</option>
        <option value="mapbox">Mapbox</option>
      </select>
    </div>
  );
}

export default MapToolbar;