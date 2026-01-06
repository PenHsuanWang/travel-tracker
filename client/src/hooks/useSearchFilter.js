/**
 * useSearchFilter Hook
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 4.3
 * 
 * A reusable hook for managing search and filter state with debouncing.
 * Handles search query, multiple filters, and provides filtered results.
 * 
 * @example
 * const {
 *   searchQuery,
 *   setSearchQuery,
 *   debouncedQuery,
 *   filters,
 *   setFilter,
 *   clearFilters,
 *   filteredItems,
 * } = useSearchFilter({
 *   items: trips,
 *   searchFields: ['name', 'description'],
 *   debounceMs: 300,
 * });
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * Custom debounce hook
 */
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * @typedef {Object} UseSearchFilterOptions
 * @property {Array} items - List of items to filter
 * @property {Array<string>} [searchFields] - Fields to search in
 * @property {number} [debounceMs=300] - Debounce delay in ms
 * @property {Object} [initialFilters={}] - Initial filter values
 * @property {Function} [customFilter] - Custom filter function
 */

/**
 * @typedef {Object} UseSearchFilterReturn
 * @property {string} searchQuery - Current search query
 * @property {Function} setSearchQuery - Set search query
 * @property {string} debouncedQuery - Debounced search query
 * @property {Object} filters - Current filter values
 * @property {Function} setFilter - Set a filter value
 * @property {Function} clearFilters - Clear all filters
 * @property {Function} resetAll - Reset search and filters
 * @property {Array} filteredItems - Filtered items
 * @property {boolean} hasActiveFilters - Whether any filters are active
 */

/**
 * useSearchFilter - Hook for managing search and filter state
 * 
 * @param {UseSearchFilterOptions} options
 * @returns {UseSearchFilterReturn}
 */
export const useSearchFilter = ({
  items = [],
  searchFields = [],
  debounceMs = 300,
  initialFilters = {},
  customFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  
  const debouncedQuery = useDebounce(searchQuery, debounceMs);

  /**
   * Set a single filter value
   */
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /**
   * Clear all filters (reset to initial values)
   */
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  /**
   * Reset both search and filters
   */
  const resetAll = useCallback(() => {
    setSearchQuery('');
    setFilters(initialFilters);
  }, [initialFilters]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const initialValue = initialFilters[key];
      return value !== initialValue && value !== '' && value !== 'all';
    });
  }, [filters, initialFilters]);

  /**
   * Default search matcher
   */
  const defaultSearchMatcher = useCallback((item, query) => {
    if (!query) return true;
    
    const lowerQuery = query.toLowerCase();
    
    return searchFields.some((field) => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], item);
      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowerQuery);
      }
      return false;
    });
  }, [searchFields]);

  /**
   * Filter items based on search and filters
   */
  const filteredItems = useMemo(() => {
    let result = items;

    // Apply search
    if (debouncedQuery) {
      result = result.filter((item) => defaultSearchMatcher(item, debouncedQuery));
    }

    // Apply custom filter if provided
    if (customFilter) {
      result = result.filter((item) => customFilter(item, filters));
    }

    return result;
  }, [items, debouncedQuery, filters, defaultSearchMatcher, customFilter]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    filters,
    setFilter,
    setFilters,
    clearFilters,
    resetAll,
    filteredItems,
    hasActiveFilters,
  };
};

export default useSearchFilter;
