// client/src/components/panels/CategoriesPanel.js
import React, { useState, useEffect } from 'react';
import { listRivers } from '../../services/api';
import '../../styles/CategoriesPanel.css';

function CategoriesPanel({ selectedRivers, setSelectedRivers }) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [riverNames, setRiverNames] = useState([]);

  // Track user's typed search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await listRivers();
        setRiverNames(data);
      } catch (error) {
        console.error('Error fetching rivers:', error);
      }
    };
    fetchData();
  }, []);

  const toggleCategories = () => {
    setCategoriesOpen(!categoriesOpen);
  };

  const handleRiverChange = (river) => {
    // Just update state - NO backend call!
    // The map component will automatically re-render with new selection
    let newSelection;
    if (selectedRivers.includes(river)) {
      newSelection = selectedRivers.filter((r) => r !== river);
    } else {
      newSelection = [...selectedRivers, river];
    }
    setSelectedRivers(newSelection);
    console.log('River selection updated:', newSelection.length, 'rivers selected');
  };

  // Filter the list of rivers by the search term (case-insensitive)
  const filteredRivers = riverNames.filter((river) =>
    river.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="CategoriesPanel">
      <h2>GIS Data Categories</h2>

      <button onClick={toggleCategories}>
        {categoriesOpen ? 'Hide' : 'Show'}
      </button>

      {categoriesOpen && (
        <div className="category-list">
          <h3>Rivers</h3>

          {/* SEARCH BAR: type here to filter the river names */}
          <input
            type="text"
            className="CategoriesPanel-search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="river-list">
            {filteredRivers.length === 0 ? (
              <p>No rivers found.</p>
            ) : (
              filteredRivers.map((river, idx) => (
                <label key={idx} className="river-option">
                  <input
                    type="checkbox"
                    checked={selectedRivers.includes(river)}
                    onChange={() => handleRiverChange(river)}
                  />
                  <span>{river}</span>
                </label>
              ))
            )}
          </div>

          {/* In the future, add more categories: Mountains, Highways, etc. */}
        </div>
      )}
    </div>
  );
}

export default CategoriesPanel;
