import React from 'react';
import '../../styles/Legend.css';

function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(item => (
        <div key={item.label} className="legend-item">
          <span
            className="legend-color"
            style={{ background: item.color }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default Legend;