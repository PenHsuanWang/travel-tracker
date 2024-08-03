import React, { useEffect, useState } from 'react';

const MapComponent = () => {
  const [mapHtml, setMapHtml] = useState('');
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState('openstreetmap'); // Default layer

  useEffect(() => {
    fetch('http://localhost:5002/api/map/layers')
      .then(response => response.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLayers(data);
          if (data.length > 0 && !selectedLayer) {
            setSelectedLayer(data[0]); // Set default to the first layer if not already set
          }
        } else {
          console.error('Expected array but received:', data);
        }
      })
      .catch(error => console.error('Error fetching layers:', error));
  }, []);

  useEffect(() => {
    if (selectedLayer) {
      const requestBody = {
        layer: selectedLayer, // Use the selected layer
      };

      fetch('http://localhost:5002/api/map/generate_map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
        .then(response => response.text())
        .then(data => setMapHtml(data))
        .catch(error => console.error('Error fetching map:', error));
    }
  }, [selectedLayer]);

  const handleLayerChange = (event) => {
    setSelectedLayer(event.target.value);
  };

  return (
    <div>
      <select onChange={handleLayerChange} value={selectedLayer}>
        {layers.map((layer) => (
          <option key={layer} value={layer}>
            {layer}
          </option>
        ))}
      </select>
      <div dangerouslySetInnerHTML={{ __html: mapHtml }} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default MapComponent;