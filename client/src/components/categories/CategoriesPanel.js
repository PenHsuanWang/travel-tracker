// client/src/components/categories/CategoriesPanel.js
import React, { useState, useEffect } from 'react';
import { listRivers, generateGisMap } from '../../services/api';
import '../../styles/CategoriesPanel.css';

function CategoriesPanel({ mapHtml, setMapHtml }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [riverNames, setRiverNames] = useState([]);
  const [selectedRivers, setSelectedRivers] = useState([]);

  useEffect(() => {
    const fetchRivers = async () => {
      try {
        const data = await listRivers();
        setRiverNames(data);
      } catch (error) {
        console.error('Error fetching river names:', error);
      }
    };
    fetchRivers();
  }, []);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleCheckboxChange = (river) => {
    if (selectedRivers.includes(river)) {
      setSelectedRivers(selectedRivers.filter((r) => r !== river));
    } else {
      setSelectedRivers([...selectedRivers, river]);
    }
  };

  const handleGenerateMap = async () => {
    try {
      const html = await generateGisMap('openstreetmap', null, selectedRivers);
      setMapHtml(html);
    } catch (error) {
      console.error('Error generating GIS map:', error);
    }
  };

  return (
    <div className="CategoriesPanel">
      <h2>Data Categories</h2>
      <div className="dropdown-container">
        <button onClick={toggleDropdown}>
          {showDropdown ? 'Hide Rivers' : 'Show Rivers'}
        </button>
        {showDropdown && (
          <div className="dropdown-content">
            {riverNames.length === 0 ? (
              <p>No rivers found.</p>
            ) : (
              riverNames.map((river, idx) => (
                <div key={idx}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedRivers.includes(river)}
                      onChange={() => handleCheckboxChange(river)}
                    />
                    {river}
                  </label>
                </div>
              ))
            )}
            {riverNames.length > 0 && (
              <button onClick={handleGenerateMap} className="generate-button">
                Generate GIS Map
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoriesPanel;