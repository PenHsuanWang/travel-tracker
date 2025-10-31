import React, { useState, useEffect } from 'react';
import '../../styles/RiverSelector.css';
import { listRivers, generateGisMap } from '../../services/api';

export default function RiverSelector({
  selectedLayer,
  selectedRivers,
  setSelectedRivers,
  setMapHtml,
}) {
  const [allRivers, setAllRivers] = useState([]);
  const [filter, setFilter] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    listRivers()
      .then(setAllRivers)
      .catch(console.error);
  }, []);

  const filtered = allRivers.filter(r =>
    r.toLowerCase().includes(filter.toLowerCase())
  );

  const toggleRiver = river => {
    const updated = selectedRivers.includes(river)
      ? selectedRivers.filter(r => r !== river)
      : [...selectedRivers, river];
    setSelectedRivers(updated);
    generateGisMap(selectedLayer, null, updated)
      .then(setMapHtml)
      .catch(console.error);
  };

  return (
    <div className="river-selector">
      <button
        className="river-toggle"
        onClick={() => setIsOpen(o => !o)}
      >
        {isOpen ? 'Hide rivers ▲' : 'Show rivers ▼'}
      </button>

      {isOpen && (
        <>
          <input
            className="river-filter"
            type="text"
            placeholder="🔍 Filter rivers..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />

          <ul className="river-list">
            {filtered.map(river => (
              <li
                key={river}
                className={
                  'river-item' +
                  (selectedRivers.includes(river) ? ' selected' : '')
                }
                onClick={() => toggleRiver(river)}
              >
                {river}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}