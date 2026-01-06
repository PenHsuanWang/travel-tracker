/**
 * useResizablePanel Hook
 * Reference: UNIFY_THEME_AND_PAGE_DETAIL_DESIGN_DOCUMENT.md Section 4.3
 * 
 * A reusable hook for managing resizable panel state.
 * Handles drag resize, collapse/expand, and optionally persists width to localStorage.
 * 
 * @example
 * const {
 *   width,
 *   isCollapsed,
 *   isResizing,
 *   handleMouseDown,
 *   toggleCollapse,
 *   expand,
 *   collapse,
 *   resetWidth,
 * } = useResizablePanel({
 *   initialWidth: 320,
 *   minWidth: 240,
 *   maxWidth: 480,
 *   storageKey: 'sidebar-width',
 * });
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * @typedef {Object} UseResizablePanelOptions
 * @property {number} [initialWidth=320] - Initial panel width
 * @property {number} [minWidth=200] - Minimum panel width
 * @property {number} [maxWidth=600] - Maximum panel width
 * @property {string} [storageKey] - localStorage key for persistence
 * @property {number} [collapseThreshold] - Width threshold to auto-collapse
 * @property {boolean} [initialCollapsed=false] - Initial collapsed state
 */

/**
 * @typedef {Object} UseResizablePanelReturn
 * @property {number} width - Current panel width
 * @property {boolean} isCollapsed - Whether panel is collapsed
 * @property {boolean} isResizing - Whether panel is being resized
 * @property {Function} handleMouseDown - Mouse down handler for resize handle
 * @property {Function} toggleCollapse - Toggle collapsed state
 * @property {Function} expand - Expand the panel
 * @property {Function} collapse - Collapse the panel
 * @property {Function} resetWidth - Reset to initial width
 * @property {Function} setWidth - Manually set width
 */

/**
 * useResizablePanel - Hook for managing resizable panel state
 * 
 * @param {UseResizablePanelOptions} options
 * @returns {UseResizablePanelReturn}
 */
export const useResizablePanel = ({
  initialWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  storageKey,
  collapseThreshold,
  initialCollapsed = false,
} = {}) => {
  // Read initial value from localStorage if available
  const getStoredWidth = () => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    }
    return initialWidth;
  };

  const getStoredCollapsed = () => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${storageKey}-collapsed`);
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return initialCollapsed;
  };

  const [width, setWidthState] = useState(getStoredWidth);
  const [isCollapsed, setIsCollapsed] = useState(getStoredCollapsed);
  const [isResizing, setIsResizing] = useState(false);
  
  // Store width before collapse to restore later
  const widthBeforeCollapse = useRef(width);

  /**
   * Persist width to localStorage
   */
  const persistWidth = useCallback((newWidth) => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(newWidth));
    }
  }, [storageKey]);

  /**
   * Persist collapsed state to localStorage
   */
  const persistCollapsed = useCallback((collapsed) => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}-collapsed`, String(collapsed));
    }
  }, [storageKey]);

  /**
   * Set width with bounds checking
   */
  const setWidth = useCallback((newWidth) => {
    const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    setWidthState(clampedWidth);
    persistWidth(clampedWidth);
    
    // Auto-collapse if below threshold
    if (collapseThreshold && clampedWidth < collapseThreshold) {
      setIsCollapsed(true);
      persistCollapsed(true);
    }
  }, [minWidth, maxWidth, collapseThreshold, persistWidth, persistCollapsed]);

  /**
   * Toggle collapsed state
   */
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      if (newState) {
        // Collapsing - save current width
        widthBeforeCollapse.current = width;
      } else {
        // Expanding - restore width
        setWidthState(widthBeforeCollapse.current);
        persistWidth(widthBeforeCollapse.current);
      }
      persistCollapsed(newState);
      return newState;
    });
  }, [width, persistWidth, persistCollapsed]);

  /**
   * Expand the panel
   */
  const expand = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setWidthState(widthBeforeCollapse.current);
      persistWidth(widthBeforeCollapse.current);
      persistCollapsed(false);
    }
  }, [isCollapsed, persistWidth, persistCollapsed]);

  /**
   * Collapse the panel
   */
  const collapse = useCallback(() => {
    if (!isCollapsed) {
      widthBeforeCollapse.current = width;
      setIsCollapsed(true);
      persistCollapsed(true);
    }
  }, [isCollapsed, width, persistCollapsed]);

  /**
   * Reset to initial width
   */
  const resetWidth = useCallback(() => {
    setWidthState(initialWidth);
    persistWidth(initialWidth);
    setIsCollapsed(false);
    persistCollapsed(false);
  }, [initialWidth, persistWidth, persistCollapsed]);

  /**
   * Mouse down handler for resize handle
   * Returns props to spread on the resize handle element
   */
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, setWidth]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return {
    width: isCollapsed ? 0 : width,
    actualWidth: width, // Always returns stored width even when collapsed
    isCollapsed,
    isResizing,
    handleMouseDown,
    toggleCollapse,
    expand,
    collapse,
    resetWidth,
    setWidth,
  };
};

export default useResizablePanel;
