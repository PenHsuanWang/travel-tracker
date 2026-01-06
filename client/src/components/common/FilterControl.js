/**
 * FilterControl Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5 (Phase 2)
 * 
 * A unified filter dropdown/button component for filtering list views.
 * Supports single-select, multi-select, and toggle modes.
 * 
 * @example
 * // Single select dropdown
 * <FilterControl
 *   label="Status"
 *   value={selectedStatus}
 *   onChange={setSelectedStatus}
 *   options={[
 *     { value: 'all', label: 'All' },
 *     { value: 'active', label: 'Active' },
 *     { value: 'draft', label: 'Draft' },
 *   ]}
 * />
 * 
 * // Toggle button
 * <FilterControl
 *   label="Has GPX"
 *   icon={<FaRoute />}
 *   type="toggle"
 *   value={hasGpx}
 *   onChange={setHasGpx}
 * />
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { FaChevronDown, FaCheck } from 'react-icons/fa';
import './FilterControl.css';

/**
 * FilterControl - Dropdown or toggle filter control
 * 
 * @param {Object} props
 * @param {string} props.label - Label text
 * @param {React.ReactNode} [props.icon] - Optional icon
 * @param {'dropdown'|'toggle'} [props.type='dropdown'] - Control type
 * @param {string|boolean} props.value - Current value
 * @param {Function} props.onChange - Value change handler
 * @param {Array<{value: string, label: string}>} [props.options] - Options for dropdown
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export const FilterControl = ({ 
  label,
  icon,
  type = 'dropdown',
  value,
  onChange,
  options = [],
  className = '',
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (type === 'toggle') {
      onChange(!value);
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [type, value, onChange]);

  const handleSelect = useCallback((optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  }, [onChange]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : label;

  const isActive = type === 'toggle' ? value : value && value !== 'all';

  const classNames = [
    'filter-control',
    `filter-control--${type}`,
    isActive && 'filter-control--active',
    isOpen && 'filter-control--open',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} ref={ref} {...props}>
      <button
        type="button"
        className="filter-control__button"
        onClick={handleToggle}
        aria-haspopup={type === 'dropdown' ? 'listbox' : undefined}
        aria-expanded={type === 'dropdown' ? isOpen : undefined}
      >
        {icon && <span className="filter-control__icon">{icon}</span>}
        <span className="filter-control__label">{displayLabel}</span>
        {type === 'dropdown' && (
          <FaChevronDown className="filter-control__chevron" />
        )}
      </button>

      {type === 'dropdown' && isOpen && (
        <div className="filter-control__dropdown" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-control__option ${value === option.value ? 'filter-control__option--selected' : ''}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={value === option.value}
            >
              <span>{option.label}</span>
              {value === option.value && <FaCheck className="filter-control__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterControl;
