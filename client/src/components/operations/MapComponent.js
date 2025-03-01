import React, { useEffect, useState } from 'react';
import { getMapLayers, generateMap } from '../../services/api';

const MapComponent = () => {
  const [mapHtml, setMapHtml] = useState('');
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState('openstreetmap');

  useEffect(() => {
    const fetchLayers = async () => {
      try {
        const data = await getMapLayers();
        if (Array.isArray(data)) {
          setLayers(data);
          if (data.length > 0 && !selectedLayer) {
            setSelectedLayer(data[0]);
          }
        } else {
          console.error('Expected array but received:', data);
        }
      } catch (error) {
        console.error('Error fetching layers:', error);
      }
    };
    fetchLayers();
  }, [selectedLayer]);

  useEffect(() => {
    if (selectedLayer) {
      const fetchMap = async () => {
        try {
          const html = await generateMap(selectedLayer);
          setMapHtml(html);
        } catch (error) {
          console.error('Error fetching map:', error);
        }
      };
      fetchMap();
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
      <div
        dangerouslySetInnerHTML={{ __html: mapHtml }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};

export default MapComponent;
