/**
 * SearchField Component
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 5 (Phase 2)
 * 
 * A unified search input component with icon and clear button.
 * Automatically adapts to theme context.
 * 
 * @example
 * <SearchField
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search trips..."
 * />
 */

import React, { useCallback } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import './SearchField.css';

/**
 * SearchField - Search input with icon and clear functionality
 * 
 * @param {Object} props
 * @param {string} props.value - Current search value
 * @param {Function} props.onChange - Value change handler
 * @param {string} [props.placeholder='Search...'] - Placeholder text
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.autoFocus=false] - Whether to auto-focus on mount
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant
 * @returns {React.ReactElement}
 */
export const SearchField = ({ 
  value, 
  onChange, 
  placeholder = 'Search...',
  className = '',
  autoFocus = false,
  size = 'md',
  ...props
}) => {
  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  const classNames = [
    'search-field',
    `search-field--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <FaSearch className="search-field__icon" aria-hidden="true" />
      <input
        type="text"
        className="search-field__input"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        {...props}
      />
      {value && (
        <button
          type="button"
          className="search-field__clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <FaTimes />
        </button>
      )}
    </div>
  );
};

export default SearchField;
