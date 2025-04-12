// client/src/components/categories/CategoriesPanel.js
import React, { useState, useEffect } from 'react';
import { listRivers, generateGisMap } from '../../services/api';
import '../../styles/CategoriesPanel.css';

function CategoriesPanel({ selectedLayer, mapHtml, setMapHtml }) {
  // You could eventually load a list of categories from the backend (e.g. Rivers, Mountains, Highways)
  // For now, we focus on "Rivers" as a single category with multiple items (the river names).
  const [showRiversDropdown, setShowRiversDropdown] = useState(false);
  const [riverNames, setRiverNames] = useState([]);
  const [selectedRivers, setSelectedRivers] = useState([]);

  // On mount, fetch the available "river" items from the backend
  useEffect(() => {
    const fetchRiverNames = async () => {
      try {
        const data = await listRivers();  // e.g. ["RiverA", "RiverB", ...]
        setRiverNames(data);
      } catch (error) {
        console.error('Error fetching river names:', error);
      }
    };
    fetchRiverNames();
  }, []);

  const toggleRiversDropdown = () => {
    setShowRiversDropdown(!showRiversDropdown);
  };

  const handleRiverCheckboxChange = (river) => {
    if (selectedRivers.includes(river)) {
      setSelectedRivers(selectedRivers.filter((r) => r !== river));
    } else {
      setSelectedRivers([...selectedRivers, river]);
    }
  };

  // This calls the backend to produce a new Folium snippet with the chosen rivers
  const handleGenerateGisMap = async () => {
    try {
      // Pass the selected rivers, plus the chosen base layer
      const html = await generateGisMap(selectedLayer, null, selectedRivers);
      setMapHtml(html);
    } catch (error) {
      console.error('Error generating GIS map:', error);
    }
  };

  return (
    <div className="CategoriesPanel" style={{ marginTop: '20px' }}>
      <h3>GIS Data Categories</h3>
      {/* In the future, you might list multiple categories: Rivers, Mountains, Highways, etc.
          For now, we just show "Rivers" as one category. */}
      <button onClick={toggleRiversDropdown}>
        {showRiversDropdown ? 'Hide Rivers' : 'Show Rivers'}
      </button>

      {showRiversDropdown && (
        <div
          style={{
            marginTop: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #ccc',
            padding: '5px'
          }}
        >
          {riverNames.length === 0 ? (
            <p>No rivers found.</p>
          ) : (
            riverNames.map((river, idx) => (
              <div key={idx}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedRivers.includes(river)}
                    onChange={() => handleRiverCheckboxChange(river)}
                  />
                  {river}
                </label>
              </div>
            ))
          )}
          {riverNames.length > 0 && (
            <button onClick={handleGenerateGisMap} style={{ marginTop: '10px' }}>
              Generate GIS Map
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoriesPanel;