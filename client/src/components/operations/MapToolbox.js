// client/src/components/operations/MapToolbox.js
/* global L */
import React, { useEffect, useState } from 'react';
import { riversData } from '../../services/api';
import '../../styles/MapToolbox.css';

function MapToolbox() {
  const [rivers, setRivers] = useState({});
  const [checked, setChecked] = useState({});
  const [layers, setLayers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRivers = async () => {
      setLoading(true);
      try {
        // Example: returns { "RiverA": [[23.4, 121.2], [23.5, 121.3], ...], "RiverB": ... }
        const data = await riversData();
        setRivers(data);
      } catch (err) {
        console.error('Error fetching rivers data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRivers();
  }, []);

  const handleToggleRiver = (riverName) => {
    const isChecked = !checked[riverName];
    setChecked((prev) => ({ ...prev, [riverName]: isChecked }));

    if (!window._leaflet_map) {
      console.warn('Leaflet map not loaded yet.');
      return;
    }

    if (isChecked) {
      if (!layers[riverName]) {
        // If the data is an array of [lat, lon] pairs:
        const latLngs = rivers[riverName] || [];
        // Or if each entry is {lat: x, lon: y}, convert them before passing to polyline:
        // const latLngs = rivers[riverName].map((point) => [point.lat, point.lon]);

        const polylineLayer = L.polyline(latLngs, { color: 'blue' });
        polylineLayer.addTo(window._leaflet_map);
        setLayers((prev) => ({ ...prev, [riverName]: polylineLayer }));
      } else {
        layers[riverName].addTo(window._leaflet_map);
      }
    } else {
      if (layers[riverName]) {
        window._leaflet_map.removeLayer(layers[riverName]);
      }
    }
  };

  const riverNames = Object.keys(rivers);

  return (
    <div className="map-toolbox">
      <h4>Rivers</h4>
      {loading ? (
        <p>Loading rivers data...</p>
      ) : riverNames.length === 0 ? (
        <p>No rivers found.</p>
      ) : (
        <div className="toolbox-list">
          {riverNames.map((name) => (
            <div key={name}>
              <label>
                <input
                  type="checkbox"
                  checked={!!checked[name]}
                  onChange={() => handleToggleRiver(name)}
                />
                {name}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapToolbox;