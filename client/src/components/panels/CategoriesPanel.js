// client/src/components/panels/CategoriesPanel.js
import React, { useState, useEffect } from 'react';
import { listRivers, generateGisMap } from '../../services/api';
import '../../styles/CategoriesPanel.css';

function CategoriesPanel({ selectedLayer, mapHtml, setMapHtml }) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [riverNames, setRiverNames] = useState([]);
  const [selectedRivers, setSelectedRivers] = useState([]);

  // NEW: track user’s typed search
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

  const handleRiverChange = async (river) => {
    let newSelection;
    if (selectedRivers.includes(river)) {
      newSelection = selectedRivers.filter((r) => r !== river);
    } else {
      newSelection = [...selectedRivers, river];
    }
    setSelectedRivers(newSelection);

    // Optionally auto-generate the map each time a user toggles
    try {
      const html = await generateGisMap(selectedLayer, null, newSelection);
      setMapHtml(html);
    } catch (error) {
      console.error('Error generating GIS map:', error);
    }
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
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', marginBottom: '10px' }}
          />

          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {filteredRivers.length === 0 ? (
              <p>No rivers found.</p>
            ) : (
              filteredRivers.map((river, idx) => (
                <div key={idx}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedRivers.includes(river)}
                      onChange={() => handleRiverChange(river)}
                    />
                    {river}
                  </label>
                </div>
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