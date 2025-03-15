// client/src/components/operations/MapToolbox.js
import React, { useEffect, useState } from 'react';
import { riversData } from '../../services/api';
import L from 'leaflet';


function MapToolbox() {
  const [rivers, setRivers] = useState({});   // { riverName: geojsonObject }
  const [checked, setChecked] = useState({}); // track toggled rivers
  const [layers, setLayers] = useState({});   // store L.GeoJSON references

  useEffect(() => {
    // On mount, fetch raw GeoJSON for all rivers
    const fetchRivers = async () => {
      try {
        const data = await riversData();
        setRivers(data);
      } catch (err) {
        console.error('Error fetching rivers data:', err);
      }
    };
    fetchRivers();
  }, []);

  const handleToggleRiver = (riverName) => {
    const isChecked = !checked[riverName];
    setChecked({ ...checked, [riverName]: isChecked });

    // If the Leaflet map object isn't ready, do nothing
    if (!window._leaflet_map) {
      console.warn('Leaflet map is not loaded yet.');
      return;
    }

    if (isChecked) {
      // Turn ON the layer
      if (!layers[riverName]) {
        // Create a new Leaflet layer from the GeoJSON
        const layer = L.geoJSON(rivers[riverName], {
          style: { color: 'blue' },
        });
        layer.addTo(window._leaflet_map);
        setLayers({ ...layers, [riverName]: layer });
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

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      left: '10px',
      zIndex: 1100,
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '4px'
    }}>
      <h4>Rivers</h4>
      {Object.keys(rivers).length === 0 ? (
        <p>Loading or no rivers found...</p>
      ) : (
        Object.keys(rivers).map((riverName) => (
          <div key={riverName}>
            <label>
              <input
                type="checkbox"
                checked={!!checked[riverName]}
                onChange={() => handleToggleRiver(riverName)}
              />
              {riverName}
            </label>
          </div>
        ))
      )}
    </div>
  );
}

export default MapToolbox;
