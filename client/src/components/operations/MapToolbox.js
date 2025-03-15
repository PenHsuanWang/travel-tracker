/* global L */  // if you rely on Folium’s embedded Leaflet
import React, { useEffect, useState } from 'react';
import { riversData } from '../../services/api';

function MapToolbox() {
  const [rivers, setRivers] = useState({});
  const [checked, setChecked] = useState({});
  const [layers, setLayers] = useState({});
  const [loading, setLoading] = useState(true);

  // 1. Defer the fetch so the base map is displayed first
  useEffect(() => {
    const fetchRivers = async () => {
      setLoading(true);
      try {
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
      // Turn ON the layer
      if (!layers[riverName]) {
        const geoJsonLayer = L.geoJSON(rivers[riverName], {
          style: { color: 'blue' },
        });
        geoJsonLayer.addTo(window._leaflet_map);
        setLayers((prev) => ({ ...prev, [riverName]: geoJsonLayer }));
      } else {
        layers[riverName].addTo(window._leaflet_map);
      }
    } else {
      // Turn OFF the layer
      if (layers[riverName]) {
        window._leaflet_map.removeLayer(layers[riverName]);
      }
    }
  };

  const riverNames = Object.keys(rivers);

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      left: '10px',
      zIndex: 1100,
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '4px',
      width: '200px'
    }}>
      <h4>Rivers</h4>
      {loading ? (
        <p>Loading rivers data... (could take a while)</p>
      ) : riverNames.length === 0 ? (
        <p>No rivers found.</p>
      ) : (
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc' }}>
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
