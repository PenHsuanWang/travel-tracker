import React from 'react';
import '../../styles/Checkbox.css';

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

export default Checkbox;