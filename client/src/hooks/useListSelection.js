/**
 * useListSelection Hook
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 4.3
 * 
 * A reusable hook for managing multi-select state in list views.
 * Handles selection toggle, select all, clear, and mode switching.
 * 
 * @example
 * const {
 *   selectedIds,
 *   selectMode,
 *   toggleSelectMode,
 *   toggleItem,
 *   selectAll,
 *   clearSelection,
 *   isSelected,
 *   selectedCount,
 * } = useListSelection({ items: trips, getItemId: (trip) => trip.id });
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * @typedef {Object} UseListSelectionOptions
 * @property {Array} items - List of items
 * @property {Function} getItemId - Function to extract ID from item
 */

/**
 * @typedef {Object} UseListSelectionReturn
 * @property {Set<string>} selectedIds - Set of selected item IDs
 * @property {boolean} selectMode - Whether selection mode is active
 * @property {Function} toggleSelectMode - Toggle selection mode on/off
 * @property {Function} toggleItem - Toggle selection of single item
 * @property {Function} selectAll - Select all items
 * @property {Function} clearSelection - Clear all selections
 * @property {Function} isSelected - Check if item is selected
 * @property {number} selectedCount - Count of selected items
 * @property {Array} selectedItems - Array of selected items
 */

/**
 * useListSelection - Hook for managing multi-select state
 * 
 * @param {UseListSelectionOptions} options
 * @returns {UseListSelectionReturn}
 */
export const useListSelection = ({ items = [], getItemId } = {}) => {
  // Provide a safe default getItemId that handles objects with `id` or primitive id values.
  const _getItemId = getItemId || ((item) => {
    if (item === null || item === undefined) return item;
    if (typeof item === 'object') return item.id ?? item._id ?? item.key ?? item.object_key ?? null;
    return item; // primitive value (string/number) assumed to be the id
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);

  /**
   * Toggle selection mode on/off
   * Clears selection when exiting select mode
   */
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) {
        // Exiting select mode - clear selections
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  /**
   * Enter selection mode (without toggling)
   */
  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
  }, []);

  /**
   * Exit selection mode and clear selections
   */
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  /**
   * Toggle selection of a single item
   */
  const toggleItem = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Select a single item (not toggle)
   */
  const selectItem = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  /**
   * Deselect a single item
   */
  const deselectItem = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /**
   * Select all items
   */
  const selectAll = useCallback(() => {
    const allIds = items.map((it) => _getItemId(it)).filter((id) => id !== null && id !== undefined);
    setSelectedIds(new Set(allIds));
  }, [items, _getItemId]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if an item is selected
   */
  const isSelected = useCallback((id) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  /**
   * Count of selected items
   */
  const selectedCount = selectedIds.size;

  /**
   * Array of selected items
   */
  const selectedItems = useMemo(() => {
    return items.filter((item) => {
      const id = _getItemId(item);
      return id !== null && id !== undefined && selectedIds.has(id);
    });
  }, [items, selectedIds, _getItemId]);

  /**
   * Whether all items are selected
   */
  const allSelected = useMemo(() => {
    // Compare against number of selectable items (those with an id)
    const selectableCount = items.map((it) => _getItemId(it)).filter((id) => id !== null && id !== undefined).length;
    return selectableCount > 0 && selectedIds.size === selectableCount;
  }, [items, selectedIds.size, _getItemId]);

  /**
   * Whether some (but not all) items are selected
   */
  const someSelected = useMemo(() => {
    const selectableCount = items.map((it) => _getItemId(it)).filter((id) => id !== null && id !== undefined).length;
    return selectedIds.size > 0 && selectedIds.size < selectableCount;
  }, [items, selectedIds.size, _getItemId]);

  return {
    selectedIds,
    selectMode,
    toggleSelectMode,
    enterSelectMode,
    exitSelectMode,
    toggleItem,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount,
    selectedItems,
    allSelected,
    someSelected,
  };
};

export default useListSelection;
