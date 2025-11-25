import React, { useState } from 'react';
import '../../styles/ChipsInput.css';

const ChipsInput = ({
  label,
  values = [],
  onChange,
  placeholder = 'Add value and press Enter',
  suggestions = [],
  disabled = false,
}) => {
  const [draft, setDraft] = useState('');

  const normalizedValues = Array.isArray(values) ? values : [];

  const emitChange = (nextValues) => {
    if (typeof onChange === 'function') {
      onChange(nextValues);
    }
  };

  const addChip = (value) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (normalizedValues.includes(trimmed)) {
      setDraft('');
      return;
    }
    emitChange([...normalizedValues, trimmed]);
    setDraft('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addChip(draft);
    } else if (event.key === 'Backspace' && !draft && normalizedValues.length) {
      emitChange(normalizedValues.slice(0, -1));
    }
  };

  const removeChip = (chip) => {
    emitChange(normalizedValues.filter((item) => item !== chip));
  };

  const handleSuggestion = (chip) => {
    if (normalizedValues.includes(chip)) return;
    emitChange([...normalizedValues, chip]);
  };

  return (
    <div className={`chips-input ${disabled ? 'is-disabled' : ''}`}>
      {label && <label>{label}</label>}
      <div className="chips-input__box" aria-live="polite">
        {normalizedValues.map((chip) => (
          <span key={chip} className="chip" role="button" tabIndex={0}>
            {chip}
            {!disabled && (
              <button type="button" aria-label={`Remove ${chip}`} onClick={() => removeChip(chip)}>
                ×
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {!disabled && suggestions?.length > 0 && (
        <div className="chips-input__suggestions">
          {suggestions.map((chip) => (
            <button
              type="button"
              key={chip}
              className={`suggestion ${normalizedValues.includes(chip) ? 'selected' : ''}`}
              onClick={() => handleSuggestion(chip)}
            >
              + {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChipsInput;
