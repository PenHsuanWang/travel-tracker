// client/src/components/categories/CategoriesPanel.js
import React, { useState, useEffect } from 'react';
import { listRivers, generateGisMap } from '../../services/api';
import '../../styles/CategoriesPanel.css';

function CategoriesPanel({ selectedLayer, mapHtml, setMapHtml }) {
  const [showRiversDropdown, setShowRiversDropdown] = useState(false);
  const [riverNames, setRiverNames] = useState([]);
  const [selectedRivers, setSelectedRivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch the list of all available GIS items (rivers, for now)
  useEffect(() => {
    const fetchRiverNames = async () => {
      try {
        const data = await listRivers();
        setRiverNames(data); // E.g., ["RiverA", "RiverB", ...]
      } catch (error) {
        console.error('Error fetching river names:', error);
      }
    };
    fetchRiverNames();
  }, []);

  const toggleRiversDropdown = () => {
    setShowRiversDropdown(!showRiversDropdown);
  };

  // When a checkbox is toggled, update selection and regenerate the map via the backend
  const handleRiverCheckboxChange = async (river) => {
    let newSelection;
    if (selectedRivers.includes(river)) {
      newSelection = selectedRivers.filter((r) => r !== river);
    } else {
      newSelection = [...selectedRivers, river];
    }
    setSelectedRivers(newSelection);

    try {
      const html = await generateGisMap(selectedLayer, null, newSelection);
      setMapHtml(html);
    } catch (error) {
      console.error('Error generating GIS map:', error);
    }
  };

  // Filter the items by search term (case-insensitive partial match)
  const filteredRivers = riverNames.filter((river) =>
    river.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="CategoriesPanel">
      <button onClick={toggleRiversDropdown}>
        {showRiversDropdown ? 'Hide List' : 'Show List'}
      </button>
      {showRiversDropdown && (
        <div className="dropdown-container">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="dropdown-content">
            {filteredRivers.length === 0 ? (
              <p>No items found.</p>
            ) : (
              filteredRivers.map((river, idx) => (
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
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoriesPanel;